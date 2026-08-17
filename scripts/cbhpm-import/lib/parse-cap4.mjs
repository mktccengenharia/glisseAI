// Parser do Capítulo 4 (Procedimentos Diagnósticos e Terapêuticos) da CBHPM.
//
// IMPORTANTE: o texto-fonte deve ser extraído com `pdftotext -table` (não
// `-layout`). Testado e confirmado: em `-layout`, as colunas "Código/
// Procedimento" e "Porte/Custo Operacional/..." são sub-tabelas com ritmos
// de linha independentes que desalinham verticalmente assim que uma
// descrição quebra em 2 linhas — o valor que aparece "colado" numa
// descrição pode pertencer à linha anterior ou seguinte, silenciosamente.
// `-table` (modo do pdftotext otimizado para tabelas) corrige isso na fonte.
//
// Diferente do Capítulo 3 (schema único e fixo), o Capítulo 4 varia de
// esquema de colunas por subseção — catalogado exaustivamente contra o
// texto-fonte (grep de todos os cabeçalhos "Código  Procedimento ..."):
//
//   porte_oper            Porte, Custo Operacional (exames simples/gerais)
//   porte_oper_anest      + Porte Anestésico (sem auxiliar)
//   porte_oper_aux        + Nº de Auxiliares (sem anestésico) — ex: Endoscopia
//   porte_oper_aux_anest  + Auxiliares + Anestésico (igual ao Capítulo 3)
//   porte_oper_doc_incid  + Custo Filme/Doc + Nº de Incidências — Radiologia
//   porte_oper_doc_ur     + Custo Filme/Doc + UR — Medicina Nuclear
//
// "UR" = Unidade de Radiofármaco. Confirmado no próprio texto-fonte (seção
// "INSTRUÇÕES ESPECÍFICAS PARA MEDICINA NUCLEAR", item 3): quase sempre
// aparece como "*" na tabela, remetendo a uma tabela de preços EXTERNA do
// Colégio Brasileiro de Radiologia — não é um valor numérico presente neste
// documento. Guardado como texto bruto (nunca inventar um número).
//
// "Incid." = número de incidências radiográficas. Confirmado por
// autoconsistência dos próprios dados: "RX – Crânio – 3 incidências" tem
// Incid.=3, "RX – Crânio – 2 incidências" tem Incid.=2, etc.

function findFirstIndexAfter(lines, pattern, afterIndex) {
  for (let i = afterIndex + 1; i < lines.length; i++) {
    if (pattern.test(lines[i])) return i
  }
  return -1
}

function findChapterContentStart(lines, headerPattern, codePattern, afterIndex, lookaheadLines = 40) {
  let from = afterIndex
  while (true) {
    const idx = findFirstIndexAfter(lines, headerPattern, from)
    if (idx === -1) return -1
    for (let k = idx + 1; k < Math.min(idx + lookaheadLines, lines.length); k++) {
      if (codePattern.test(lines[k].trim())) return idx
    }
    from = idx
  }
}

// Detecção de schema por PALAVRA-CHAVE, não por string exata — confirmado
// contra as 7 edições que a ORDEM das colunas no cabeçalho varia por PDF
// (ex: "UR ou DOC. Porte Oper." na 2014 vs "Porte Oper. ou Doc. UR" na
// 2018) e as abreviações também variam ("Inc." vs "Incid."). Testar
// presença de palavra-chave, não posição, é robusto a ambos.
// "M2" só aparece nos cabeçalhos da 3ª edição (confirmado: as outras 6
// edições não têm essa palavra em nenhum cabeçalho de Capítulo 4) e marca um
// defeito de extração exclusivo dela — ver schema *_m2 e o comentário em
// parseTail. Não generalizar essa detecção para outras edições sem
// confirmar a mesma inversão de coluna nelas.
function detectSchema(headerText) {
  const hasM2 = /\bM2\b/.test(headerText)
  const hasUR = /\bUR\b/.test(headerText)
  const hasIncid = /\bInc(id)?\.?\b/i.test(headerText)
  const hasAux = /\bAux\.?\b/i.test(headerText)
  const hasAnest = /\bAnest\.?\b/i.test(headerText)

  if (hasM2 && hasUR) return 'porte_oper_doc_ur_m2'
  if (hasM2 && hasIncid) return 'porte_oper_doc_incid_m2'
  if (hasUR) return 'porte_oper_doc_ur'
  if (hasIncid) return 'porte_oper_doc_incid'
  if (hasAux && hasAnest) return 'porte_oper_aux_anest'
  if (hasAux) return 'porte_oper_aux'
  if (hasAnest) return 'porte_oper_anest'
  return 'porte_oper'
}

// Campos (em ordem) que cada schema produz, além de porte/custo_operacional
// (que todo schema tem)
const SCHEMA_FIELDS = {
  porte_oper: [],
  porte_oper_anest: ['porte_anestesico'],
  porte_oper_aux: ['numero_auxiliares'],
  porte_oper_aux_anest: ['numero_auxiliares', 'porte_anestesico'],
  porte_oper_doc_incid: ['custo_filme_doc', 'numero_incidencias'],
  porte_oper_doc_ur: ['custo_filme_doc', 'unidade_radiofarmaco'],
  // Variantes "_m2": mesmas 4 colunas de valor de porte_oper_doc_incid/_ur,
  // mas em ORDEM DIFERENTE — ver comentário em parseTail. Só o 1º campo é
  // real; a 4ª coluna ("M2") é descartada de propósito (confirmado com o
  // usuário em 2026-08-17: não é usada em nenhum cálculo do produto).
  porte_oper_doc_incid_m2: ['numero_incidencias'],
  porte_oper_doc_ur_m2: ['unidade_radiofarmaco'],
}

const M2_SCHEMAS = new Set(['porte_oper_doc_incid_m2', 'porte_oper_doc_ur_m2'])

const HEADER_LINE_RE = /^C[óo]digo\s+Procedimento\s*(.*)$/
const NOISE_PATTERNS = [
  /^\s*$/,
  /^\s*PROCEDIMENTOS DIAGNÓSTICOS E TERAPÊUTICOS\s*$/,
  /^\s*Custo(\s+(Filme|N[°º o]?\s*de))?\s*$/i,
  /^\s*Filme\s*$/i,
  /^\s*Porte(\s+Oper\.)?\s*$/i,
  /^\s*Oper\.\s*$/i,
  /^\s*(N[°º o]?\s*de\s+)?Aux\.?\s*$/i,
  /^\s*Anest\.\s*$/i,
  /^\s*ou\s+Doc\.\s*$/i,
  /^\s*UR\s*$/,
  /^\s*Incid\.\s*$/i,
  /^\d{1,4}$/,
  /Classificação Brasileira Hierarquizada de Procedimentos Médicos/i,
  /^\s*CAPÍTULO\s*$/,
]

function isNoise(line) {
  return NOISE_PATTERNS.some((re) => re.test(line))
}

const SECTION_RE = /^([A-ZÀ-Ú][A-ZÀ-Ú \-\/,()0-9]*?)\s+4\.\d{2}\.\d{2}\.\d{2}-\d\s*$/
const CODE_RE = /^(4\.\d{2}\.\d{2}\.\d{2}-\d)\s+(.*)$/
const DASH = /^[–\-—]$/
// Ordem importa: decimal-com-vírgula e porte-com-letra são mais específicos
// e devem ser tentados antes do inteiro solto (usado por Aux./Anest./Incid.)
const FIELD = '(?:[\\d.]+,\\d+|\\d{1,2}[A-D]|\\d{1,2}|\\*|[–\\-—])'

const SINGLE_FIELD_RE = new RegExp(`^${FIELD}$`)

// Conta quantos tokens no FINAL da linha (da direita pra esquerda) são,
// individualmente, um valor reconhecível (número, decimal, porte-com-letra,
// "*" ou traço). Usado só pelos schemas "_m2" para distinguir a forma de
// linha validada (exatamente 4 valores) de outras formas (ex: 6 valores em
// "RADIOLOGIA INTERVENCIONISTA") que têm colunas extras não confirmadas —
// ver parseTail.
function countTrailingFields(trimmed) {
  const tokens = trimmed.split(/\s+/)
  let count = 0
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (SINGLE_FIELD_RE.test(tokens[i])) count++
    else break
  }
  return count
}

const TAIL_REGEX_CACHE = new Map()
function tailRegexFor(fieldCount) {
  if (!TAIL_REGEX_CACHE.has(fieldCount)) {
    const groups = Array.from({ length: fieldCount }, (_, i) => `(?<f${i}>${FIELD})`).join('\\s+')
    TAIL_REGEX_CACHE.set(fieldCount, new RegExp(`^(?<descricao>.*\\S)\\s+${groups}\\s*$`))
  }
  return TAIL_REGEX_CACHE.get(fieldCount)
}

function parsePorte(v) { return DASH.test(v) ? null : v }
function parseDecimal(v) { return DASH.test(v) || v === '*' ? null : Number(v.replace(/\./g, '').replace(',', '.')) }
function parseAuxCount(v) { return DASH.test(v) ? 0 : Number(v) } // "–" em Aux. = 0 (não paga auxiliar), convenção já usada no Cap. 3
function parseIntOrNull(v) { return DASH.test(v) ? null : Number(v) }
function parseRawText(v) { return DASH.test(v) ? null : v } // UR: preserva "*" literal, nunca inventa número

const FIELD_PARSERS = {
  numero_auxiliares: parseAuxCount,
  porte_anestesico: parseIntOrNull,
  custo_filme_doc: parseDecimal,
  numero_incidencias: parseIntOrNull,
  unidade_radiofarmaco: parseRawText,
}

function parseTail(text, schema) {
  const trimmed = text.trim()
  const extraFields = SCHEMA_FIELDS[schema]
  // Schemas "_m2" sempre têm 4 colunas de valor: 1 campo real (extraFields[0])
  // + custo_operacional + porte + 1 coluna descartada — nunca 2+extraFields.length.
  const fieldCount = M2_SCHEMAS.has(schema) ? 4 : 2 + extraFields.length
  const m = tailRegexFor(fieldCount).exec(trimmed)
  if (!m) return null

  const { descricao, ...tailGroups } = m.groups
  const descricaoLimpa = descricao.replace(/[.\s]{4,}$/, '').replace(/\s+/g, ' ').trim()
  const values = Object.keys(tailGroups).sort().map((k) => tailGroups[k])

  const result = { descricao: descricaoLimpa }

  if (M2_SCHEMAS.has(schema)) {
    // DEFEITO DE EXTRAÇÃO EXCLUSIVO DA 3ª EDIÇÃO (cabeçalho traz "M2" — não
    // ocorre nas outras 6 edições, confirmado por grep em todas as fontes).
    // Ordem real das 4 colunas nessa seção, confirmada com o usuário em
    // 2026-08-17 comparando com o nome do procedimento (ex: "Crânio - 2
    // incidências" tem 1º valor = 2) e com o valor de porte no banco (4A =
    // R$ 120 bate com a tabela de valores; a ordem padrão do resto do
    // capítulo colocava esse mesmo "4A" na 3ª posição, nunca lido):
    //   [0] Inc./UR (campo real, extraFields[0])
    //   [1] Custo Operacional
    //   [2] Porte (sempre com letra 1A-14C)
    //   [3] coluna "M2" — descartada de propósito, sem uso conhecido no cálculo
    //
    // Só validado para linhas com EXATAMENTE 4 valores. Uma minoria (seção
    // "RADIOLOGIA INTERVENCIONISTA") tem 6 valores na linha — forma NÃO
    // confirmada com o usuário; nunca adivinhar aqui (Artigo IV), então essas
    // linhas retornam null e caem no fallback padrão de "fonte incompleta"
    // de parseEdition, igual a qualquer outro caso não reconhecido.
    if (countTrailingFields(trimmed) !== 4) return null
    const [fieldName] = extraFields
    result.porte = parsePorte(values[2])
    result.custo_operacional = parseDecimal(values[1])
    result[fieldName] = FIELD_PARSERS[fieldName](values[0])
  } else {
    result.porte = parsePorte(values[0])
    result.custo_operacional = parseDecimal(values[1])
    extraFields.forEach((fieldName, idx) => {
      result[fieldName] = FIELD_PARSERS[fieldName](values[2 + idx])
    })
  }

  const camposNaoAplicaveis = ['numero_auxiliares', 'porte_anestesico', 'custo_filme_doc', 'numero_incidencias', 'unidade_radiofarmaco']
    .filter((f) => !extraFields.includes(f))
  for (const f of camposNaoAplicaveis) result[f] = null

  result.fonteIncompleta = result.porte === null || result.custo_operacional === null
  return result
}

/**
 * @param {string} raw texto completo extraído do PDF via `pdftotext -table -enc UTF-8`
 * @param {string} versaoLabel ex: "CBHPM 2018"
 */
export function parseEdition(raw, versaoLabel) {
  const lines = raw.split(/\r?\n/)

  const CODE4_RE = /^4\.\d{2}\.\d{2}\.\d{2}-\d/
  const chapterStart = findChapterContentStart(lines, /^\s*PROCEDIMENTOS DIAGNÓSTICOS E TERAPÊUTICOS\s*$/, CODE4_RE, -1)
  const chapterEnd = lines.length // último capítulo do documento — não há próximo cabeçalho para delimitar o fim

  if (chapterStart === -1) {
    throw new Error(`Falha ao delimitar o Capítulo 4 em "${versaoLabel}". chapterStart=${chapterStart}`)
  }

  const body = lines.slice(chapterStart, chapterEnd)
  const records = []
  const parseErrors = []
  const notesSkipped = []
  const unknownHeaders = []
  let currentSecao = null
  let activeSchema = 'porte_oper' // default até o primeiro cabeçalho real ser encontrado
  let inObservacoes = false

  for (let i = 0; i < body.length; i++) {
    const line = body[i]

    const headerMatch = HEADER_LINE_RE.exec(line.trim())
    if (headerMatch) {
      const key = headerMatch[1].trim().replace(/\s+/g, ' ')
      if (key) {
        activeSchema = detectSchema(key)
        unknownHeaders.push({ key, schemaDetectado: activeSchema, linha: chapterStart + i + 1 })
      }
      inObservacoes = false
      continue
    }

    const secMatch = SECTION_RE.exec(line.trim())
    if (secMatch && !CODE_RE.test(line.trim())) {
      currentSecao = secMatch[1].trim()
      inObservacoes = false
      continue
    }

    if (isNoise(line)) continue

    const codeMatch = CODE_RE.exec(line.trim())
    if (!codeMatch) continue

    const [, codigo, restStart] = codeMatch

    if (/^OBSERVA/i.test(restStart.trim())) {
      notesSkipped.push({ codigo, linha: chapterStart + i + 1 })
      inObservacoes = true
      continue
    }

    // Dentro de um bloco de OBSERVAÇÕES, o texto livre às vezes menciona um
    // código real no meio da explicação (ex: "4.09.01.17-3 Abdome inferior
    // masculino ..., não são remunerados concomitantemente"). Só aceita como
    // registro novo se a linha JÁ tiver porte+valores colados (dado
    // tabular real de verdade) — nunca via lookahead/wrap dentro de um
    // bloco de notas, que é sempre prosa contínua, não tabela.
    if (inObservacoes) {
      const parsedDireto = parseTail(restStart, activeSchema)
      if (!parsedDireto) {
        notesSkipped.push({ codigo, linha: chapterStart + i + 1 })
        continue
      }
      inObservacoes = false
    }

    let rest = restStart
    let wasWrapped = false
    let parsed = parseTail(rest, activeSchema)

    let lookaheadUsed = 0
    let j = i + 1
    while (!parsed && lookaheadUsed < 3 && j < body.length) {
      const nextLine = body[j]
      if (isNoise(nextLine)) { j++; continue }
      if (CODE_RE.test(nextLine.trim())) break
      if (SECTION_RE.test(nextLine.trim())) break
      if (HEADER_LINE_RE.test(nextLine.trim())) break
      rest = `${rest} ${nextLine.trim()}`
      parsed = parseTail(rest, activeSchema)
      wasWrapped = true
      lookaheadUsed++
      j++
    }

    if (!parsed) {
      const candidato = restStart.trim()
      const pareceDescricaoReal =
        candidato.length >= 4 &&
        !CODE_RE.test(candidato) &&
        /^[A-ZÀ-Ú]/.test(candidato) &&
        !/^[\(\)]/.test(candidato)

      if (pareceDescricaoReal) {
        // Alguns registros (sobretudo painéis laboratoriais com porte
        // fracionário, ex: "... 0,10 de 1A 1,070") não batem com nenhum
        // schema conhecido e caem aqui sem porte determinável — mas a
        // descrição bruta ainda carrega o preenchimento em pontos + a
        // fórmula de preço, que não deve vazar para o nome do procedimento.
        const descricaoLimpa = candidato
          .replace(/\.{3,}.*$/s, '')
          .replace(/[.\s]{4,}$/, '')
          .replace(/\s+/g, ' ')
          .trim()
        records.push({
          codigo,
          procedimento: descricaoLimpa || candidato.replace(/\s+/g, ' ').trim(),
          secao: currentSecao,
          capitulo: '4 - Procedimentos Diagnósticos e Terapêuticos',
          schema: activeSchema,
          porte: null, custo_operacional: null, numero_auxiliares: null, porte_anestesico: null,
          custo_filme_doc: null, numero_incidencias: null, unidade_radiofarmaco: null,
          fonteIncompleta: true, semPorte: true,
          versao: versaoLabel, wasWrapped: false, linhaOrigem: chapterStart + i + 1,
        })
      } else {
        parseErrors.push({ codigo, linha: chapterStart + i + 1, textoBruto: restStart, schema: activeSchema })
      }
      continue
    }

    i = wasWrapped ? j - 1 : i

    records.push({
      codigo,
      procedimento: parsed.descricao,
      secao: currentSecao,
      capitulo: '4 - Procedimentos Diagnósticos e Terapêuticos',
      schema: activeSchema,
      porte: parsed.porte,
      custo_operacional: parsed.custo_operacional,
      numero_auxiliares: parsed.numero_auxiliares,
      porte_anestesico: parsed.porte_anestesico,
      custo_filme_doc: parsed.custo_filme_doc,
      numero_incidencias: parsed.numero_incidencias,
      unidade_radiofarmaco: parsed.unidade_radiofarmaco,
      fonteIncompleta: parsed.fonteIncompleta,
      semPorte: false,
      versao: versaoLabel,
      wasWrapped,
      linhaOrigem: chapterStart + i + 1,
    })
  }

  const seen = new Map()
  const duplicates = []
  for (const r of records) {
    if (seen.has(r.codigo)) duplicates.push({ codigo: r.codigo, linhas: [seen.get(r.codigo), r.linhaOrigem] })
    else seen.set(r.codigo, r.linhaOrigem)
  }

  const bySchema = {}
  for (const r of records) bySchema[r.schema] = (bySchema[r.schema] || 0) + 1

  const report = {
    versao: versaoLabel,
    totalLinhasCapitulo: body.length,
    totalRegistrosParseados: records.length,
    totalWrapped: records.filter((r) => r.wasWrapped).length,
    totalFonteIncompleta: records.filter((r) => r.fonteIncompleta).length,
    totalSemPorte: records.filter((r) => r.semPorte).length,
    totalParseErrors: parseErrors.length,
    totalNotesSkipped: notesSkipped.length,
    totalDuplicates: duplicates.length,
    totalUnknownHeaders: unknownHeaders.length,
    registrosPorSchema: bySchema,
    parseErrors,
    duplicates,
    unknownHeaders,
  }

  return { records, report }
}

export function buildSample(records) {
  const clean = records.filter((r) => !r.wasWrapped && !r.fonteIncompleta)
  const wrapped = records.filter((r) => r.wasWrapped)
  const incompletas = records.filter((r) => r.fonteIncompleta)
  // Amostra estratificada por schema, não só aleatória — para garantir que a
  // conferência humana veja exemplos de TODOS os 6 formatos de coluna, não
  // só do mais frequente.
  const porSchema = new Map()
  for (const r of clean) {
    const arr = porSchema.get(r.schema) || []
    if (arr.length < 12) arr.push(r)
    porSchema.set(r.schema, arr)
  }
  const amostraPorSchema = [...porSchema.values()].flat()
  return [...wrapped, ...incompletas, ...amostraPorSchema].sort((a, b) => a.linhaOrigem - b.linhaOrigem)
}

export function toCsv(sampleRows) {
  const header = 'codigo,procedimento,secao,schema,porte,custo_operacional,numero_auxiliares,porte_anestesico,custo_filme_doc,numero_incidencias,unidade_radiofarmaco,wasWrapped,fonteIncompleta,semPorte,linhaOrigem'
  const lines = sampleRows.map((r) =>
    [r.codigo, `"${r.procedimento.replace(/"/g, '""')}"`, `"${(r.secao || '').replace(/"/g, '""')}"`, r.schema,
      r.porte, r.custo_operacional ?? '', r.numero_auxiliares ?? '', r.porte_anestesico ?? '',
      r.custo_filme_doc ?? '', r.numero_incidencias ?? '', r.unidade_radiofarmaco ?? '',
      r.wasWrapped, r.fonteIncompleta, r.semPorte, r.linhaOrigem].join(',')
  )
  return [header, ...lines].join('\n')
}
