// Parser reutilizável do Capítulo 3 (Procedimentos Cirúrgicos e Invasivos) da
// CBHPM — mesma lógica validada manualmente na edição 2018, parametrizada por
// arquivo/versão para reaproveitar nas demais edições (marcadores de capítulo
// são idênticos em todas: "CAPÍTULO 3 –" / "CAPÍTULO 4 –" no sumário, seguidos
// pelos cabeçalhos de página "PROCEDIMENTOS CIRÚRGICOS E INVASIVOS" /
// "PROCEDIMENTOS DIAGNÓSTICOS E TERAPÊUTICOS").

function findFirstIndexAfter(lines, pattern, afterIndex) {
  for (let i = afterIndex + 1; i < lines.length; i++) {
    if (pattern.test(lines[i])) return i
  }
  return -1
}

// Formato do sumário varia por edição: algumas usam "CAPÍTULO 3 – TÍTULO" numa
// linha só, outras usam "CAPÍTULO 3" isolado com o título na linha seguinte —
// em ambos os casos essa é só a entrada do SUMÁRIO, não o início real do
// capítulo (que se repete como cabeçalho de página, uma vez por página, com
// conteúdo tabular de verdade logo depois). Por isso: acha a PRIMEIRA
// ocorrência do cabeçalho de página que é seguida, em poucas linhas, por um
// código de procedimento real — só essa marca o início de conteúdo de fato.
function findChapterContentStart(lines, headerPattern, codePattern, afterIndex, lookaheadLines = 40) {
  let from = afterIndex
  while (true) {
    const idx = findFirstIndexAfter(lines, headerPattern, from)
    if (idx === -1) return -1
    for (let k = idx + 1; k < Math.min(idx + lookaheadLines, lines.length); k++) {
      if (codePattern.test(lines[k].trim())) return idx
    }
    from = idx // não achou código por perto, essa ocorrência era só sumário/menção — continua procurando
  }
}

const NOISE_PATTERNS = [
  /^\s*$/,
  /^\s*PROCEDIMENTOS CIRÚRGICOS E INVASIVOS\s*$/,
  /^Código\s+Procedimento/i,
  /^\s*(Custo\s+)?N[°º o]?\s*de\s+Porte\s*$/i,
  /^\s*Porte\s+Oper\.\s+Aux\.\s+Anest\.\s*$/i,
  /^\s*Oper\.\s*Aux\.\s*Anest\.\s*$/i,
  /^\d{1,4}$/,
  /Classificação Brasileira Hierarquizada de Procedimentos Médicos/i,
  /^\s*CAPÍTULO\s*$/,
]

function isNoise(line) {
  return NOISE_PATTERNS.some((re) => re.test(line))
}

const SECTION_RE = /^([A-ZÀ-Ú][A-ZÀ-Ú \-\/,()0-9]*?)\s+\d\.\d{2}\.\d{2}\.\d{2}-\d\s*$/
const CODE_RE = /^(\d\.\d{2}\.\d{2}\.\d{2}-\d)\s+(.*)$/
const DASH = /^[–\-—]$/
const PORTE_TAIL_RE_LETRA = /^(?<descricao>.*\S)\s+(?<porte>\d{1,2}[A-D])(?<mid>.*)$/
const PORTE_TAIL_RE_DASH = /^(?<descricao>.*\S)\s+(?<porte>[–\-—])(?<mid>.*)$/

function splitAuxAnest(blob) {
  if (blob.length === 1) return { aux: null, anest: blob }
  if (blob.length === 2) return { aux: blob[0], anest: blob[1] }
  return null
}

function parseTail(text) {
  const trimmed = text.trim()
  const m = PORTE_TAIL_RE_LETRA.exec(trimmed) || PORTE_TAIL_RE_DASH.exec(trimmed)
  if (!m) return null
  const { descricao, porte, mid } = m.groups
  // Algumas edições (3ª) usam pontos de preenchimento estilo sumário entre o
  // nome do procedimento e as colunas numéricas (ex: "Biópsia ..........").
  const descricaoLimpa = descricao.replace(/[.\s]{4,}$/, '').replace(/\s+/g, ' ').trim()
  const porteVal = DASH.test(porte) ? null : porte
  const midTrim = mid.trim()

  if (midTrim === '') {
    return {
      descricao: descricaoLimpa, porte: porteVal,
      custo_operacional: null, numero_auxiliares: null, porte_anestesico: null,
      fonteIncompleta: true,
    }
  }

  const tokens = midTrim.split(/\s+/)
  const first = tokens[0]
  const isExplicitCusto = DASH.test(first) || /^\d[\d.]*,\d+$/.test(first)
  let custoStr = null
  let rest = tokens

  if (isExplicitCusto) {
    custoStr = first
    rest = tokens.slice(1)
  }

  const restBlob = rest.join('')

  if (rest.length === 0 || restBlob.length > 2) {
    if (isExplicitCusto && rest.length === 0) {
      return {
        descricao: descricaoLimpa, porte: porteVal,
        custo_operacional: DASH.test(custoStr) ? null : Number(custoStr.replace(/\./g, '').replace(',', '.')),
        numero_auxiliares: null, porte_anestesico: null, fonteIncompleta: true,
      }
    }
    return null
  }

  const split = splitAuxAnest(restBlob)
  if (!split) return null

  return {
    descricao: descricaoLimpa,
    porte: porteVal,
    custo_operacional: isExplicitCusto
      ? (DASH.test(custoStr) ? null : Number(custoStr.replace(/\./g, '').replace(',', '.')))
      : null,
    numero_auxiliares: split.aux === null ? null : (DASH.test(split.aux) ? 0 : Number(split.aux)),
    porte_anestesico: DASH.test(split.anest) ? null : Number(split.anest),
    fonteIncompleta: split.aux === null,
  }
}

/**
 * @param {string} raw texto completo extraído do PDF (pdftotext -layout -enc UTF-8)
 * @param {string} versaoLabel ex: "CBHPM 2018"
 */
export function parseEdition(raw, versaoLabel) {
  const lines = raw.split(/\r?\n/)

  const CODE3_RE = /^3\.\d{2}\.\d{2}\.\d{2}-\d/
  const CODE4_RE = /^4\.\d{2}\.\d{2}\.\d{2}-\d/
  const chapterStart = findChapterContentStart(lines, /^\s*PROCEDIMENTOS CIRÚRGICOS E INVASIVOS\s*$/, CODE3_RE, -1)
  const chapterEnd = findChapterContentStart(lines, /^\s*PROCEDIMENTOS DIAGNÓSTICOS E TERAPÊUTICOS\s*$/, CODE4_RE, chapterStart)

  if (chapterStart === -1 || chapterEnd === -1 || chapterEnd <= chapterStart) {
    throw new Error(`Falha ao delimitar o Capítulo 3 em "${versaoLabel}". chapterStart=${chapterStart} chapterEnd=${chapterEnd}`)
  }

  const body = lines.slice(chapterStart, chapterEnd)
  const records = []
  const parseErrors = []
  const notesSkipped = []
  let currentSecao = null

  for (let i = 0; i < body.length; i++) {
    const line = body[i]

    const secMatch = SECTION_RE.exec(line.trim())
    if (secMatch && !CODE_RE.test(line.trim())) {
      currentSecao = secMatch[1].trim()
      continue
    }

    if (isNoise(line)) continue

    const codeMatch = CODE_RE.exec(line.trim())
    if (!codeMatch) continue

    const [, codigo, restStart] = codeMatch

    if (/^OBSERVA[ÇC][ÃÕ]/i.test(restStart.trim())) {
      notesSkipped.push({ codigo, linha: chapterStart + i + 1 })
      continue
    }

    let rest = restStart
    let wasWrapped = false
    let parsed = parseTail(rest)

    let lookaheadUsed = 0
    let j = i + 1
    while (!parsed && lookaheadUsed < 3 && j < body.length) {
      const nextLine = body[j]
      if (isNoise(nextLine)) { j++; continue }
      if (CODE_RE.test(nextLine.trim())) break
      if (SECTION_RE.test(nextLine.trim())) break
      rest = `${rest} ${nextLine.trim()}`
      parsed = parseTail(rest)
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
        records.push({
          codigo,
          procedimento: candidato.replace(/[.\s]{4,}$/, '').replace(/\s+/g, ' ').trim(),
          secao: currentSecao,
          capitulo: '3 - Procedimentos Cirúrgicos e Invasivos',
          porte: null, custo_operacional: null, numero_auxiliares: null, porte_anestesico: null,
          fonteIncompleta: true, semPorte: true,
          versao: versaoLabel, wasWrapped: false, linhaOrigem: chapterStart + i + 1,
        })
      } else {
        parseErrors.push({ codigo, linha: chapterStart + i + 1, textoBruto: restStart })
      }
      continue
    }

    i = wasWrapped ? j - 1 : i

    records.push({
      codigo,
      procedimento: parsed.descricao,
      secao: currentSecao,
      capitulo: '3 - Procedimentos Cirúrgicos e Invasivos',
      porte: parsed.porte,
      custo_operacional: parsed.custo_operacional,
      numero_auxiliares: parsed.numero_auxiliares,
      porte_anestesico: parsed.porte_anestesico,
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
    parseErrors,
    duplicates,
  }

  return { records, report }
}

export function buildSample(records) {
  const clean = records.filter((r) => !r.wasWrapped && !r.fonteIncompleta)
  const wrapped = records.filter((r) => r.wasWrapped)
  const incompletas = records.filter((r) => r.fonteIncompleta)
  const randomSample = [...clean].sort(() => Math.random() - 0.5).slice(0, 30)
  return [...wrapped, ...incompletas, ...randomSample].sort((a, b) => a.linhaOrigem - b.linhaOrigem)
}

export function toCsv(sampleRows) {
  const header = 'codigo,procedimento,secao,porte,custo_operacional,numero_auxiliares,porte_anestesico,wasWrapped,fonteIncompleta,semPorte,linhaOrigem'
  const lines = sampleRows.map((r) =>
    [r.codigo, `"${r.procedimento.replace(/"/g, '""')}"`, `"${(r.secao || '').replace(/"/g, '""')}"`, r.porte,
      r.custo_operacional ?? '', r.numero_auxiliares ?? '', r.porte_anestesico ?? '', r.wasWrapped, r.fonteIncompleta, r.semPorte, r.linhaOrigem].join(',')
  )
  return [header, ...lines].join('\n')
}
