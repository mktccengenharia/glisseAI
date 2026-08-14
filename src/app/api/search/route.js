// Rota de API: /api/search
// Busca procedimentos no Supabase (por código exato, full-text ou similaridade de texto)

import { createClient } from '@supabase/supabase-js'
import { rateLimit } from '@/lib/rate-limit'
import { embedQuery } from '@/lib/embeddings'

// Capítulos com dados importados hoje (ver scripts/cbhpm-import/). A CBHPM
// tem só 4 capítulos no total (confirmado no texto-fonte) — cobertura
// completa desde 2026-08-12. Usado para distinguir, numa busca sem
// resultado, "não existe na CBHPM" de "capítulo ainda não coberto" — ver
// docs/opportunity-mapping.md item 3.3.
export const COVERED_CHAPTERS = ['1', '2', '3', '4']

// Códigos CBHPM têm sempre 8 dígitos no formato D.DD.DD.DD-D. Usuários
// colando de outro sistema digitam de jeitos variados que não batem
// literalmente contra "codigo" (salvo sempre formatado com ponto/hífen):
//   "30913012"     (sem nenhuma pontuação)
//   "3-09-13-01-2" (pontuação errada — hífen em vez de ponto)
//   "3 09 13 01 2" (espaços)
//   "3-09-13"      (código parcial com separador errado/faltando)
// Reconstrói a pontuação sempre que der pra reconhecer dígitos "soltos" de
// um código: 8 dígitos completos (qualquer separador ou nenhum), ou menos
// de 8 dígitos MAS com pelo menos um separador já digitado (sinal de que o
// usuário claramente tentou pontuar um código parcial). Buscas numéricas
// curtas sem nenhuma pontuação (ex: "12") ficam como estão — sem sinal de
// que é um fragmento de código, reformatar mudaria o resultado sem necessidade.
export function normalizeCodigoSearchTerm(term) {
  const hasSeparator = /[.\-\s]/.test(term)
  const digits = term.replace(/[.\-\s]/g, '')
  if (!/^\d+$/.test(digits) || digits.length === 0 || digits.length > 8) return term
  if (digits.length !== 8 && !hasSeparator) return term

  const GROUP_SIZES = [1, 2, 2, 2, 1]
  const SEPARATORS = ['.', '.', '.', '-']
  const groups = []
  let i = 0
  for (const size of GROUP_SIZES) {
    if (i >= digits.length) break
    groups.push(digits.slice(i, i + size))
    i += size
  }
  return groups.reduce((acc, g, idx) => (idx === 0 ? g : `${acc}${SEPARATORS[idx - 1]}${g}`), '')
}

// Ramo da cascata de busca que produziu o resultado. Serve a dois propósitos:
// rotular na UI o que veio do fallback semântico como aproximado (nunca por
// limiar de similaridade — a RPC é `returns setof` e não devolve score, ver
// Story 1.6 restrição 1) e registrar o tipo real de match em search_events,
// que é a base de calibração para o limiar de uma story futura.
export const MATCH_TYPES = {
  CODIGO: 'codigo',
  TEXTO: 'texto',
  TEXTO_SEM_ACENTO: 'texto-sem-acento',
  SEMANTICO: 'semantico',
}

// Conjunto único de campos devolvido ao frontend. Os quatro caminhos de busca
// convergem para ele: código exato e full-text via `select`, as duas RPCs via
// pickResultFields — as RPCs são `returns setof public.cbhpm_procedures` e
// devolvem TODAS as colunas, então, sem normalizar, o mesmo procedimento
// chegava à UI com conjuntos de campos diferentes conforme quem respondeu.
// "embedding" fica de fora de propósito: 384 números por linha (vários KB por
// resultado) que a UI não usa e não devem trafegar até o browser.
export const RESULT_FIELDS = [
  'id',
  'codigo',
  'procedimento',
  'porte',
  'valor_porte',
  'uco',
  'valor_uco',
  'anestesia',
  'versao',
  'observacao',
  'created_at',
  'capitulo',
  'numero_auxiliares',
  'porte_anestesico',
  'custo_operacional',
  'custo_filme_doc',
  'numero_incidencias',
  'unidade_radiofarmaco',
  'valor_versao',
  'aux_pct',
]

const SELECT_COLUMNS = RESULT_FIELDS.join(', ')

// Normaliza uma linha para exatamente RESULT_FIELDS. Campo ausente vira null
// (não `undefined`), para que o JSON da resposta tenha o mesmo conjunto de
// chaves nos quatro caminhos de busca.
export function pickResultFields(row) {
  const out = {}
  for (const field of RESULT_FIELDS) {
    out[field] = row?.[field] ?? null
  }
  return out
}

// Best-effort: loga TODA busca (com e sem resultado) para medir a taxa real de
// sucesso e orientar a priorização de expansão de cobertura com dado de uso
// (docs/opportunity-mapping.md item 1.4).
//
// NÃO bloqueante de propósito: /api/search é a rota mais quente do produto e o
// insert passou a ocorrer em toda busca, não só no ramo vazio (raro). Nenhum
// `await` aqui — a resposta não espera o registro.
//
// Continua tolerando a ausência da tabela search_events (migration da SEÇÃO 11
// de supabase/schema.sql, aplicação manual ainda pendente — a seção 10 é
// chat_feedback): a busca funciona normalmente enquanto a tabela não existir,
// só não registra nada.
function logSearchEvent(supabase, { term, version, tipo, teveResultado }) {
  try {
    Promise.resolve(
      supabase.from('search_events').insert({
        termo: term,
        versao: version,
        tipo,
        teve_resultado: teveResultado,
      })
    ).catch(() => {
      // Tabela pode não existir ainda; não deve afetar a resposta da busca.
    })
  } catch {
    // Falha síncrona ao montar o insert também não pode derrubar a busca.
  }
}

export async function GET(request) {
  const { allowed, retryAfterSeconds } = rateLimit(request, {
    scope: 'search',
    limit: 30,
    windowMs: 60_000,
  })
  if (!allowed) {
    return Response.json(
      { error: 'Muitas requisições. Tente novamente em instantes.' },
      { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } }
    )
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY // Usar service key no backend

  if (!supabaseUrl || !supabaseKey) {
    console.error('Supabase env vars ausentes (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)')
    return Response.json({ error: 'Serviço de busca não configurado' }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')
  const version = searchParams.get('version') || 'ALL'

  if (typeof query !== 'string' || query.trim().length < 2) {
    return Response.json({ results: [], matchType: null, coveredChapters: COVERED_CHAPTERS })
  }

  const term = query.trim().slice(0, 200)

  // Detecta se é busca por código (padrão numérico com pontos/hífens/espaços)
  const isCodeSearch = /^[\d\.\-\s]+$/.test(term)

  const searchTerm = isCodeSearch ? normalizeCodigoSearchTerm(term) : term

  function baseQuery() {
    let q = supabase.from('cbhpm_procedures').select(SELECT_COLUMNS)
    if (version !== 'ALL') q = q.eq('versao', version)
    return q
  }

  const hasRows = (rows) => Array.isArray(rows) && rows.length > 0

  let data, error
  // Qual ramo da cascata produziu o resultado. Fica null enquanto nenhum ramo
  // devolveu linha (busca sem resultado).
  let matchType = null

  if (isCodeSearch) {
    ;({ data, error } = await baseQuery().ilike('codigo', `%${searchTerm}%`).limit(10))
    if (!error && hasRows(data)) matchType = MATCH_TYPES.CODIGO
  } else {
    // Full-text search em português (usa o índice GIN já existente sobre
    // to_tsvector('portuguese', procedimento)) — tolera termos parciais fora
    // de ordem e variações morfológicas melhor que ILIKE puro.
    ;({ data, error } = await baseQuery()
      .textSearch('procedimento', term, { type: 'websearch', config: 'portuguese' })
      .limit(10))
    if (!error && hasRows(data)) matchType = MATCH_TYPES.TEXTO

    // Fallback: termos muito curtos/atípicos podem não gerar tsquery útil,
    // ou o termo pode ser uma substring que a busca full-text não pega (ex:
    // prefixo de palavra), ou tem acentuação diferente do texto salvo (ex:
    // "dissecçao" vs "Dissecção" — full-text 'portuguese' não ignora acento).
    // Usa a RPC com unaccent (seção 14 de supabase/schema.sql); se a
    // migration ainda não foi aplicada, cai para o ILIKE simples anterior.
    if (!error && (!data || data.length === 0)) {
      const { data: unaccentData, error: unaccentError } = await supabase.rpc('search_cbhpm_procedures_unaccent', {
        search_term: term,
        filter_versao: version !== 'ALL' ? version : null,
        match_count: 10,
      })
      if (unaccentError) {
        console.error('Busca sem acento indisponível (migration aplicada?):', unaccentError.message)
        ;({ data, error } = await baseQuery().ilike('procedimento', `%${term}%`).limit(10))
      } else {
        data = unaccentData
      }
      // O ILIKE degradado é o mesmo ramo do ponto de vista do usuário: match
      // literal de texto, não aproximado. Só a RPC não estava disponível.
      if (!error && hasRows(data)) matchType = MATCH_TYPES.TEXTO_SEM_ACENTO
    }

    // Busca semântica (embeddings open source, rodados localmente — ver
    // src/lib/embeddings.js): último recurso quando nem full-text nem ILIKE
    // encontram nada. Cobre sinônimos e termos técnicos que não compartilham
    // nenhuma palavra literal com o texto do procedimento (ex: "tirar
    // próstata" → "RTU de Próstata"). Best-effort: se a coluna/RPC ainda não
    // existir (migration da seção 12 de supabase/schema.sql pendente) ou o
    // modelo falhar ao carregar, não derruba a busca — só não encontra nada.
    if (!error && (!data || data.length === 0)) {
      try {
        const queryEmbedding = await embedQuery(term)
        const { data: semanticData, error: semanticError } = await supabase.rpc('match_cbhpm_procedures', {
          query_embedding: queryEmbedding,
          match_count: 10,
          filter_versao: version !== 'ALL' ? version : null,
        })
        if (semanticError) {
          console.error('Busca semântica indisponível (migration aplicada?):', semanticError.message)
        } else if (semanticData) {
          data = semanticData
          // Único ramo que produz resultado APROXIMADO: a RPC ordena por
          // distância vetorial e devolve as N mais próximas, por mais
          // distantes que sejam. A UI precisa rotular isso ao faturista.
          if (hasRows(data)) matchType = MATCH_TYPES.SEMANTICO
        }
      } catch (semanticErr) {
        console.error('Busca semântica indisponível (migration aplicada? modelo carregou?):', semanticErr.message)
      }
    }
  }

  if (error) {
    console.error('Supabase query error:', error)
    return Response.json({ error: 'Erro ao buscar no banco de dados' }, { status: 500 })
  }

  // Normaliza os quatro caminhos para o mesmo conjunto de campos. É também o
  // que garante que "embedding" nunca chegue ao client pelas RPCs.
  const results = (data || []).map(pickResultFields)
  const teveResultado = results.length > 0

  // Toda busca é registrada, não só a que voltou vazia. Sem `await`: a
  // resposta não espera o insert.
  logSearchEvent(supabase, {
    term,
    version,
    // Sem resultado não há ramo de match; mantém o tipo base ('codigo'/'texto')
    // que o log já usava, para não quebrar a leitura dos eventos antigos.
    tipo: teveResultado ? matchType : isCodeSearch ? MATCH_TYPES.CODIGO : MATCH_TYPES.TEXTO,
    teveResultado,
  })

  return Response.json({
    results,
    // Identifica o ramo que respondeu para a UI poder rotular o resultado do
    // fallback semântico como aproximado (AC4). Nunca um score de similaridade.
    matchType: teveResultado ? matchType : null,
    coveredChapters: COVERED_CHAPTERS,
  })
}
