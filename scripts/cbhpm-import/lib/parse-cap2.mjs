// Parser reutilizável do Capítulo 2 (Procedimentos Clínicos) da CBHPM.
// Formato: código + descrição + porte + custo operacional (coluna separada).
//
// Particularidades:
// - Custo operacional aparece intercalado nas linhas pelo pdftotext -layout
//   (à direita, muitas vezes em linhas separadas ou no final da linha do porte)
// - Sem auxiliares / porte anestésico
// - Subseções: Ambulatoriais (2.01.XX) e Hospitalares (2.02.XX)
//
// Delimitação: "PROCEDIMENTOS CLÍNICOS" seguido de código 2.XX →
// até "PROCEDIMENTOS CIRÚRGICOS E INVASIVOS" seguido de código 3.XX.

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

const NOISE_PATTERNS = [
  /^\s*$/,
  /^\s*PROCEDIMENTOS CL[ÍI]NICOS\s*$/i,
  /^PROCEDIMENTOS CL[ÍI]NICOS AMBULATORIAIS/i,
  /^PROCEDIMENTOS CL[ÍI]NICOS HOSPITALARES/i,
  /^Código\s+Procedimento/i,
  /^Código\s+Procedimentos/i,
  /^\s*Porte\s+(Custo|Oper)/i,
  /^\s*Custo\s*$/i,
  /^\s*Oper\.\s*$/i,
  /^\s*Porte\s*$/i,
  /^\d{1,4}\s*(Classifica|$)/,
  /Classificação Brasileira Hierarquizada de Procedimentos Médicos/i,
  /^\s*CAPÍTULO\s*$/,
  /^\s*\d+\s*$/,
  /^\s*Procedimentos\s*$/,
]

function isNoise(line) {
  return NOISE_PATTERNS.some((re) => re.test(line))
}

// Subseção: "AVALIAÇÕES / ACOMPANHAMENTOS (2.01.01.00-7)" ou
// "AVALIAÇÕES / ACOMPANHAMENTOS  2.01.01.00-7"
const SECTION_RE = /^([A-ZÀ-Ú][A-ZÀ-Ú \-\/,()0-9]*?)\s+\(?\d\.\d{2}\.\d{2}\.\d{2}-\d\)?\s*$/

// Código de procedimento: 2.XX.XX.XX-X
const CODE_RE = /^(2\.\d{2}\.\d{2}\.\d{2}-\d)\s+(.*)$/

const DASH = /^[–\-—]$/
// Porte: 1-2 dígitos + letra A-D. Pode estar seguido por custo operacional ou "–"
const PORTE_RE = /(\d{1,2}[A-D])\s*$/

/**
 * Tenta extrair porte e custo operacional do texto restante.
 * Padrões possíveis:
 *   "Descrição ... 2B"            → porte=2B, custo=null
 *   "Descrição ... 2B  –"         → porte=2B, custo=null (não aplicável)
 *   "Descrição ... 2B  6,000"     → porte=2B, custo=6.0
 *   "Descrição ... 2B"  (custo na linha seguinte — tratado pelo caller via contexto)
 */
function extractPorteCusto(text) {
  const cleaned = text.replace(/[.\s]{4,}$/, '').trim()

  // Tenta achar porte + custo no final
  // Padrão: ...descrição  <porte>  [custo]
  // custo pode ser: número decimal com vírgula, "–", ou ausente

  // Primeiro, tenta porte + custo (com custo no final)
  const fullMatch = /^(.*\S)\s+(\d{1,2}[A-D])\s+([\d.,]+|[–\-—])\s*$/.exec(cleaned)
  if (fullMatch) {
    const descricao = fullMatch[1].replace(/[.\s]{4,}$/, '').replace(/\s+/g, ' ').trim()
    const porte = fullMatch[2]
    const custoStr = fullMatch[3]
    const custo = DASH.test(custoStr)
      ? null
      : Number(custoStr.replace(/\./g, '').replace(',', '.'))
    return { descricao, porte, custo_operacional: custo }
  }

  // Sem custo, só porte no final
  const porteMatch = PORTE_RE.exec(cleaned)
  if (porteMatch) {
    const porte = porteMatch[1]
    const descricao = cleaned.slice(0, porteMatch.index).replace(/[.\s]{4,}$/, '').replace(/\s+/g, ' ').trim()
    return { descricao, porte, custo_operacional: null }
  }

  return null
}

/**
 * @param {string} raw  texto completo extraído do PDF
 * @param {string} versaoLabel  ex: "CBHPM 2018"
 */
export function parseCap2(raw, versaoLabel) {
  const lines = raw.split(/\r?\n/)

  const CODE2_RE_START = /^2\.\d{2}\.\d{2}\.\d{2}-\d/
  const CODE3_RE_START = /^3\.\d{2}\.\d{2}\.\d{2}-\d/

  const chapterStart = findChapterContentStart(
    lines, /^\s*PROCEDIMENTOS CL[ÍI]NICOS\s*$/i, CODE2_RE_START, -1
  )
  const chapterEnd = findChapterContentStart(
    lines, /^\s*PROCEDIMENTOS CIR[ÚU]RGICOS E INVASIVOS\s*$/i, CODE3_RE_START, chapterStart
  )

  if (chapterStart === -1 || chapterEnd === -1 || chapterEnd <= chapterStart) {
    throw new Error(`Falha ao delimitar o Capítulo 2 em "${versaoLabel}". chapterStart=${chapterStart} chapterEnd=${chapterEnd}`)
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
      currentSecao = secMatch[1].replace(/\(.*$/, '').trim()
      continue
    }

    if (isNoise(line)) continue

    // Linhas soltas com só custo operacional (número ou "–"): artefato do layout
    // em colunas; ignorar pois o custo é pego da linha do próprio código
    if (/^\s*[\d.,]+\s*$/.test(line.trim()) || /^\s*[–\-—]\s*$/.test(line.trim())) continue

    const codeMatch = CODE_RE.exec(line.trim())
    if (!codeMatch) continue

    const [, codigo, restStart] = codeMatch

    if (/^OBSERVA[ÇC][ÃÕ]/i.test(restStart.trim())) {
      notesSkipped.push({ codigo, linha: chapterStart + i + 1 })
      continue
    }

    // Artefato de layout em colunas: código seguido apenas de um custo
    // operacional solto (ex: "2.01.03.42-5   0,590"). Não é um procedimento
    // real — o custo pertence a outro procedimento na coluna ao lado. Pula.
    if (/^\s*[\d.,]+\s*$/.test(restStart.trim()) || /^\s*[–\-—]\s*$/.test(restStart.trim()) || restStart.trim() === '') {
      continue
    }

    let rest = restStart
    let wasWrapped = false
    let parsed = extractPorteCusto(rest)

    // Lookahead para wrap de descrição
    let lookaheadUsed = 0
    let j = i + 1
    while (!parsed && lookaheadUsed < 3 && j < body.length) {
      const nextLine = body[j]
      if (isNoise(nextLine)) { j++; continue }
      if (CODE_RE.test(nextLine.trim())) break
      if (SECTION_RE.test(nextLine.trim())) break
      // Ignora linhas que são só custo operacional solto
      if (/^\s*[\d.,]+\s*$/.test(nextLine.trim()) || /^\s*[–\-—]\s*$/.test(nextLine.trim())) { j++; continue }
      rest = `${rest} ${nextLine.trim()}`
      parsed = extractPorteCusto(rest)
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
        !/^[()]/.test(candidato)

      if (pareceDescricaoReal) {
        records.push({
          codigo,
          procedimento: candidato.replace(/[.\s]{4,}$/, '').replace(/\s+/g, ' ').trim(),
          secao: currentSecao,
          capitulo: '2 - Procedimentos Clínicos',
          porte: null,
          custo_operacional: null,
          numero_auxiliares: null,
          porte_anestesico: null,
          fonteIncompleta: true,
          semPorte: true,
          versao: versaoLabel,
          wasWrapped: false,
          linhaOrigem: chapterStart + i + 1,
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
      capitulo: '2 - Procedimentos Clínicos',
      porte: parsed.porte,
      custo_operacional: parsed.custo_operacional,
      numero_auxiliares: null,     // Cap. 2 não tem auxiliares
      porte_anestesico: null,      // Cap. 2 não tem porte anestésico
      fonteIncompleta: false,
      semPorte: false,
      versao: versaoLabel,
      wasWrapped,
      linhaOrigem: chapterStart + i + 1,
    })
  }

  // Deduplica
  const seen = new Map()
  const duplicates = []
  for (const r of records) {
    if (seen.has(r.codigo)) duplicates.push({ codigo: r.codigo, linhas: [seen.get(r.codigo), r.linhaOrigem] })
    else seen.set(r.codigo, r.linhaOrigem)
  }

  const report = {
    versao: versaoLabel,
    capitulo: 2,
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
