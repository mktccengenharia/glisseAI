// Rota de API: /api/search
// Busca procedimentos no Supabase (por código exato, full-text ou similaridade de texto)

import { createClient } from '@supabase/supabase-js'
import { rateLimit } from '@/lib/rate-limit'

// Capítulos com dados importados hoje (ver scripts/cbhpm-import/). Usado para
// distinguir, numa busca sem resultado, "não existe na CBHPM" de "capítulo
// ainda não coberto pelo pipeline de importação" — ver docs/opportunity-mapping.md item 3.3.
export const COVERED_CHAPTERS = ['1', '2', '3']

// Best-effort: loga buscas sem resultado para orientar a priorização de
// expansão de capítulos com dado real de uso (docs/opportunity-mapping.md item 1.4).
// Não bloqueia nem falha a busca se a tabela search_events ainda não existir
// (migration em supabase/schema.sql, seção 10, precisa ser aplicada manualmente).
async function logEmptySearch(supabase, { term, version, isCodeSearch }) {
  try {
    await supabase.from('search_events').insert({
      termo: term,
      versao: version,
      tipo: isCodeSearch ? 'codigo' : 'texto',
      teve_resultado: false,
    })
  } catch {
    // Tabela pode não existir ainda; não deve afetar a resposta da busca.
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
    return Response.json({ results: [], coveredChapters: COVERED_CHAPTERS })
  }

  const term = query.trim().slice(0, 200)

  // Detecta se é busca por código (padrão numérico com pontos/hífens)
  const isCodeSearch = /^[\d\.\-]+$/.test(term)

  function baseQuery() {
    let q = supabase.from('cbhpm_procedures').select('*')
    if (version !== 'ALL') q = q.eq('versao', version)
    return q
  }

  let data, error

  if (isCodeSearch) {
    ;({ data, error } = await baseQuery().ilike('codigo', `%${term}%`).limit(10))
  } else {
    // Full-text search em português (usa o índice GIN já existente sobre
    // to_tsvector('portuguese', procedimento)) — tolera termos parciais fora
    // de ordem e variações morfológicas melhor que ILIKE puro.
    ;({ data, error } = await baseQuery()
      .textSearch('procedimento', term, { type: 'websearch', config: 'portuguese' })
      .limit(10))

    // Fallback: termos muito curtos/atípicos podem não gerar tsquery útil,
    // ou o termo pode ser uma substring que a busca full-text não pega
    // (ex: prefixo de palavra). Mantém o comportamento anterior como rede de segurança.
    if (!error && (!data || data.length === 0)) {
      ;({ data, error } = await baseQuery().ilike('procedimento', `%${term}%`).limit(10))
    }
  }

  if (error) {
    console.error('Supabase query error:', error)
    return Response.json({ error: 'Erro ao buscar no banco de dados' }, { status: 500 })
  }

  const results = data || []
  if (results.length === 0) {
    await logEmptySearch(supabase, { term, version, isCodeSearch })
  }

  return Response.json({ results, coveredChapters: COVERED_CHAPTERS })
}
