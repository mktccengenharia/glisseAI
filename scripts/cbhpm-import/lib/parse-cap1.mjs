// Parser reutilizável do Capítulo 1 (Procedimentos Gerais: Consultas, Visitas,
// Recém-nascido, UTI, Remoção, Outros) da CBHPM.
// Formato: código + descrição + porte (sem custo operacional/auxiliares/anest.)
//
// Delimitação: cabeçalho "PROCEDIMENTOS GERAIS" seguido de código 1.XX →
// até primeiro aparecimento de "PROCEDIMENTOS CLÍNICOS" seguido de código 2.XX.

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
  /^\s*PROCEDIMENTOS GERAIS\s*$/i,
  /^Código\s+Procedimento/i,
  /^Código\s+Procedimentos/i,
  /^\s*Porte\s*$/i,
  /^\d{1,4}\s*(Classifica|$)/,
  /Classificação Brasileira Hierarquizada de Procedimentos Médicos/i,
  /^\s*CAPÍTULO\s*$/,
  /^\s*\d+\s*$/,                         // número de página isolado
  /^CONSULTAS\s+PROCEDIMENTOS GERAIS/i,  // artefato de pdftotext de algumas edições
  /^CONSULTAS\s+\d\.\d{2}/,              // "CONSULTAS  1.01.00.00-X" cabeçalho
  /^\s*Procedimentos\s*$/,               // label de coluna
  /^\s*Custo\s*$/i,
  /^\s*Oper\.\s*$/i,
]

function isNoise(line) {
  return NOISE_PATTERNS.some((re) => re.test(line))
}

// Subseções como "CONSULTAS (1.01.01.00-4)" ou "CONSULTAS  1.01.01.00-4"
const SECTION_RE = /^([A-ZÀ-Ú][A-ZÀ-Ú \-\/,()0-9]*?)\s+\(?\d\.\d{2}\.\d{2}\.\d{2}-\d\)?\s*$/

// Código de procedimento: 1.XX.XX.XX-X seguido de descrição
const CODE_RE = /^(1\.\d{2}\.\d{2}\.\d{2}-\d)\s+(.*)$/

// Porte: 1-2 dígitos + letra A-D no final da linha (opcionalmente precedido por pontos)
const PORTE_RE = /(\d{1,2}[A-D])\s*$/

/**
 * Extrai porte do final do texto. Capítulo 1 não tem custo/aux/anest,
 * então o porte é sempre a última coisa na linha.
 */
function extractPorte(text) {
  // Remove pontos de preenchimento estilo sumário
  const cleaned = text.replace(/[.\s]{4,}$/, '').trim()
  const m = PORTE_RE.exec(cleaned)
  if (!m) return null
  const porte = m[1]
  const descricao = cleaned.slice(0, m.index).replace(/[.\s]{4,}$/, '').replace(/\s+/g, ' ').trim()
  return { descricao, porte }
}

/**
 * @param {string} raw  texto completo extraído do PDF (pdftotext -layout -enc UTF-8)
 * @param {string} versaoLabel  ex: "CBHPM 2018"
 */
export function parseCap1(raw, versaoLabel) {
  const lines = raw.split(/\r?\n/)

  const CODE1_RE_START = /^1\.\d{2}\.\d{2}\.\d{2}-\d/
  const CODE2_RE_START = /^2\.\d{2}\.\d{2}\.\d{2}-\d/

  const chapterStart = findChapterContentStart(
    lines, /^\s*PROCEDIMENTOS GERAIS\s*$/i, CODE1_RE_START, -1
  )
  const chapterEnd = findChapterContentStart(
    lines, /^\s*PROCEDIMENTOS CL[ÍI]NICOS\s*$/i, CODE2_RE_START, chapterStart
  )

  if (chapterStart === -1 || chapterEnd === -1 || chapterEnd <= chapterStart) {
    throw new Error(`Falha ao delimitar o Capítulo 1 em "${versaoLabel}". chapterStart=${chapterStart} chapterEnd=${chapterEnd}`)
  }

  const body = lines.slice(chapterStart, chapterEnd)
  const records = []
  const parseErrors = []
  const notesSkipped = []
  let currentSecao = null

  for (let i = 0; i < body.length; i++) {
    const line = body[i]

    // Detecta cabeçalho de subseção
    const secMatch = SECTION_RE.exec(line.trim())
    if (secMatch && !CODE_RE.test(line.trim())) {
      currentSecao = secMatch[1].replace(/\(.*$/, '').trim()
      continue
    }

    if (isNoise(line)) continue

    const codeMatch = CODE_RE.exec(line.trim())
    if (!codeMatch) continue

    const [, codigo, restStart] = codeMatch

    // Observações não são procedimentos
    if (/^OBSERVA[ÇC][ÃÕ]/i.test(restStart.trim())) {
      notesSkipped.push({ codigo, linha: chapterStart + i + 1 })
      continue
    }

    let rest = restStart
    let wasWrapped = false
    let parsed = extractPorte(rest)

    // Lookahead: até 3 linhas seguintes para wrap de descrição
    let lookaheadUsed = 0
    let j = i + 1
    while (!parsed && lookaheadUsed < 3 && j < body.length) {
      const nextLine = body[j]
      if (isNoise(nextLine)) { j++; continue }
      if (CODE_RE.test(nextLine.trim())) break
      if (SECTION_RE.test(nextLine.trim())) break
      rest = `${rest} ${nextLine.trim()}`
      parsed = extractPorte(rest)
      wasWrapped = true
      lookaheadUsed++
      j++
    }

    if (!parsed) {
      // Sem porte — registra como stub se parecer descrição real
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
          capitulo: '1 - Procedimentos Gerais',
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
      capitulo: '1 - Procedimentos Gerais',
      porte: parsed.porte,
      custo_operacional: null,        // Cap. 1 não tem custo operacional
      numero_auxiliares: null,         // Cap. 1 não tem auxiliares
      porte_anestesico: null,          // Cap. 1 não tem porte anestésico
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
    capitulo: 1,
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
