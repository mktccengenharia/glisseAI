// Parser do Capítulo 3 (Procedimentos Cirúrgicos e Invasivos) da CBHPM 2018.
// Lê o texto extraído por 01-extract-text.mjs e produz um JSON estruturado
// por código, com relatório de qualidade e amostra para conferência humana.
// Uso: node scripts/cbhpm-import/02-parse-cap3.mjs

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TMP_DIR = path.join(__dirname, 'tmp')
const OUT_DIR = path.join(__dirname, 'output')
fs.mkdirSync(OUT_DIR, { recursive: true })

const raw = fs.readFileSync(path.join(TMP_DIR, 'cbhpm-2018.txt'), 'utf8')
const lines = raw.split(/\r?\n/)

// ─── Delimitação do capítulo ────────────────────────────────────────────────

function findFirstIndexAfter(pattern, afterIndex) {
  for (let i = afterIndex + 1; i < lines.length; i++) {
    if (pattern.test(lines[i])) return i
  }
  return -1
}

const toc3 = lines.findIndex((l) => l.includes('CAPÍTULO 3 –'))
const chapterStart = findFirstIndexAfter(/^\s*PROCEDIMENTOS CIRÚRGICOS E INVASIVOS\s*$/, toc3)
const toc4 = lines.findIndex((l) => l.includes('CAPÍTULO 4 –'))
const chapterEnd = findFirstIndexAfter(/^\s*PROCEDIMENTOS DIAGNÓSTICOS E TERAPÊUTICOS\s*$/, Math.max(toc4, chapterStart))

if (chapterStart === -1 || chapterEnd === -1 || chapterEnd <= chapterStart) {
  console.error(`Falha ao delimitar o Capítulo 3. chapterStart=${chapterStart} chapterEnd=${chapterEnd}`)
  process.exit(1)
}

console.log(`Capítulo 3 delimitado: linhas ${chapterStart}-${chapterEnd} (${chapterEnd - chapterStart} linhas)`)

const body = lines.slice(chapterStart, chapterEnd)

// ─── Filtros de ruído (cabeçalho/rodapé/página) ─────────────────────────────

const NOISE_PATTERNS = [
  /^\s*$/, // linha vazia
  /^\s*PROCEDIMENTOS CIRÚRGICOS E INVASIVOS\s*$/,
  /^Código\s+Procedimento/i,
  /^\s*(Custo\s+)?N[°º]?\s*de\s+Porte\s*$/i,
  /^\s*Porte\s+Oper\.\s+Aux\.\s+Anest\.\s*$/i,
  /^\s*Oper\.\s*Aux\.\s*Anest\.\s*$/i,
  /^\d{1,4}$/, // número de página isolado
  /Classificação Brasileira Hierarquizada de Procedimentos Médicos/i,
  /^\s*CAPÍTULO\s*$/,
]

function isNoise(line) {
  return NOISE_PATTERNS.some((re) => re.test(line))
}

// Marcador de subseção (ex: "PELE E TECIDO CELULAR SUBCUTÂNEO / ANEXOS   3.01.00.00-3"
// ou "PROCEDIMENTOS  3.01.01.00-0") — não é uma linha de procedimento (o código
// não está no início da linha), então CODE_RE já não bate nela; tratamos como
// contexto de "seção" para o campo `secao`, não como ruído a descartar.
const SECTION_RE = /^([A-ZÀ-Ú][A-ZÀ-Ú \-\/,()0-9]*?)\s+\d\.\d{2}\.\d{2}\.\d{2}-\d\s*$/

// ─── Parsing linha a linha ───────────────────────────────────────────────────

const CODE_RE = /^(\d\.\d{2}\.\d{2}\.\d{2}-\d)\s+(.*)$/

const DASH = /^[–\-—]$/
// Âncora: descrição termina em porte cirúrgico (ex: "13A", "6B"). Tentada PRIMEIRO
// e de forma estrita (só dígitos+letra) para nunca deixar a busca greedy confundir
// o porte real com um traço de "custo ausente" no meio da linha.
const PORTE_TAIL_RE_LETRA = /^(?<descricao>.*\S)\s+(?<porte>\d{1,2}[A-D])(?<mid>.*)$/
// Fallback: linhas de anestesiologia pura, sem porte cirúrgico (porte = "–").
const PORTE_TAIL_RE_DASH = /^(?<descricao>.*\S)\s+(?<porte>[–\-—])(?<mid>.*)$/

// Explica a lógica: depois do porte sobra `mid`, que pode ser:
//  a) vazio                          -> custo/aux/anest não impressos na fonte (fonteIncompleta)
//  b) "–" "– –" "– – –" etc          -> custo/aux/anest todos "–" (nenhum aplicável)
//  c) "<custo-explícito> <auxanest>" -> custo é "–" OU um número com vírgula/ponto decimal;
//                                       o que sobra depois é aux+anest (1-2 chars, glued ou espaçado)
//  d) "<auxanest>" (1-2 chars puros, sem marcador de custo) -> custo ausente (null), NÃO é "0";
//     só nesse caso restrito (1-2 dígitos/traços, nada mais) é seguro decompor aux+anest pelo
//     último caractere = anestésico (regra: porte anestésico 0-8, sempre 1 dígito — confirmado
//     no próprio texto do PDF, item 2 das normas de Anestesiologia)
//  e) qualquer outra coisa           -> ambíguo, não decompor: parseError para checagem manual

function splitAuxAnest(blob) {
  // blob já sem espaços, 1 ou 2 caracteres: [aux]anest ou apenas anest
  if (blob.length === 1) {
    return { aux: null, anest: blob } // só 1 caractere: tratamos como só porte anestésico (raro, fica registrado)
  }
  if (blob.length === 2) {
    return { aux: blob[0], anest: blob[1] }
  }
  return null // mais de 2 caracteres não é um par aux+anest válido
}

function parseTail(text) {
  const trimmed = text.trim()
  const m = PORTE_TAIL_RE_LETRA.exec(trimmed) || PORTE_TAIL_RE_DASH.exec(trimmed)
  if (!m) return null
  const { descricao, porte, mid } = m.groups
  const descricaoLimpa = descricao.replace(/\s+/g, ' ').trim()
  const porteVal = DASH.test(porte) ? null : porte
  const midTrim = mid.trim()

  if (midTrim === '') {
    return {
      descricao: descricaoLimpa,
      porte: porteVal,
      custo_operacional: null,
      numero_auxiliares: null,
      porte_anestesico: null,
      fonteIncompleta: true, // colunas custo/aux/anest não impressas nesta linha — exige checagem manual
    }
  }

  const tokens = midTrim.split(/\s+/)

  // Caso (b)/(c): primeiro token é um custo explícito ("–" ou número decimal)
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
    // custo explícito mas nada de aux/anest depois (raro) — ou lixo residual demais: ambíguo
    if (isExplicitCusto && rest.length === 0) {
      return {
        descricao: descricaoLimpa,
        porte: porteVal,
        custo_operacional: DASH.test(custoStr) ? null : Number(custoStr.replace(/\./g, '').replace(',', '.')),
        numero_auxiliares: null,
        porte_anestesico: null,
        fonteIncompleta: true,
      }
    }
    return null // ambíguo demais — parseError
  }

  const split = splitAuxAnest(restBlob)
  if (!split) return null

  return {
    descricao: descricaoLimpa,
    porte: porteVal,
    custo_operacional: isExplicitCusto
      ? (DASH.test(custoStr) ? null : Number(custoStr.replace(/\./g, '').replace(',', '.')))
      : null,
    // aux "–" em cirurgia = 0 (não paga auxiliar); aux null (custo/aux totalmente ausentes) = fonte incompleta
    numero_auxiliares: split.aux === null ? null : (DASH.test(split.aux) ? 0 : Number(split.aux)),
    porte_anestesico: DASH.test(split.anest) ? null : Number(split.anest),
    // aux ausente é sempre fonte incompleta, com ou sem custo explícito antes dele
    fonteIncompleta: split.aux === null,
  }
}

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
  if (!codeMatch) continue // linha de continuação solta sem âncora — tratada abaixo via lookahead

  const [, codigo, restStart] = codeMatch

  // Nota "OBSERVAÇÕES" (ex: "3.02.01.99-3 OBSERVAÇÕES") não é um procedimento — registra e pula.
  if (/^OBSERVA[ÇC][ÃÕ]/i.test(restStart.trim())) {
    notesSkipped.push({ codigo, linha: chapterStart + i + 1 })
    continue
  }

  let rest = restStart
  let wasWrapped = false
  let parsed = parseTail(rest)

  // Lookahead: se a cauda numérica não bateu na própria linha, tenta anexar
  // até 3 linhas seguintes não-ruído/não-âncora antes de desistir.
  let lookaheadUsed = 0
  let j = i + 1
  while (!parsed && lookaheadUsed < 3 && j < body.length) {
    const nextLine = body[j]
    if (isNoise(nextLine)) { j++; continue }
    if (CODE_RE.test(nextLine.trim())) break // próxima âncora — não é continuação
    if (SECTION_RE.test(nextLine.trim())) break
    rest = `${rest} ${nextLine.trim()}`
    parsed = parseTail(rest)
    wasWrapped = true
    lookaheadUsed++
    j++
  }

  if (!parsed) {
    // Sem porte determinável nem com lookahead. Ainda assim, se o texto bruto
    // parece uma descrição de procedimento real (não é outro código, não é
    // fragmento truncado começando com parênteses/minúscula, tamanho plausível),
    // registramos como stub pesquisável (código + nome, tudo o mais null) em vez
    // de descartar. Texto que parece corrompido/fragmento fica de fora mesmo.
    const candidato = restStart.trim()
    const pareceDescricaoReal =
      candidato.length >= 4 &&
      !CODE_RE.test(candidato) && // não é "outro código" solto (referência a código antigo)
      /^[A-ZÀ-Ú]/.test(candidato) && // começa com maiúscula (nome de procedimento real)
      !/^[\(\)]/.test(candidato) // não começa com parêntese (fragmento/nota de rodapé)

    if (pareceDescricaoReal) {
      records.push({
        codigo,
        procedimento: candidato.replace(/\s+/g, ' ').trim(),
        secao: currentSecao,
        capitulo: '3 - Procedimentos Cirúrgicos e Invasivos',
        porte: null,
        custo_operacional: null,
        numero_auxiliares: null,
        porte_anestesico: null,
        fonteIncompleta: true,
        semPorte: true, // nem o porte foi determinado (diferente dos demais fonteIncompleta)
        versao: 'CBHPM 2018',
        wasWrapped: false,
        linhaOrigem: chapterStart + i + 1,
      })
    } else {
      parseErrors.push({ codigo, linha: chapterStart + i + 1, textoBruto: restStart })
    }
    continue
  }

  i = wasWrapped ? j - 1 : i // avança o cursor principal se consumimos linhas de lookahead

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
    versao: 'CBHPM 2018',
    wasWrapped,
    linhaOrigem: chapterStart + i + 1,
  })
}

// ─── Checagem de duplicidade ─────────────────────────────────────────────────

const seen = new Map()
const duplicates = []
for (const r of records) {
  if (seen.has(r.codigo)) duplicates.push({ codigo: r.codigo, linhas: [seen.get(r.codigo), r.linhaOrigem] })
  else seen.set(r.codigo, r.linhaOrigem)
}

// ─── Saída ───────────────────────────────────────────────────────────────────

const report = {
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

fs.writeFileSync(path.join(OUT_DIR, 'cbhpm-2018-cap3.json'), JSON.stringify(records, null, 2))
fs.writeFileSync(path.join(OUT_DIR, 'cbhpm-2018-cap3-report.json'), JSON.stringify(report, null, 2))

// Amostra estratificada para conferência humana: todos os wrapped, todos os
// parseErrors, e 60 aleatórios do restante.
const clean = records.filter((r) => !r.wasWrapped && !r.fonteIncompleta)
const wrapped = records.filter((r) => r.wasWrapped)
const incompletas = records.filter((r) => r.fonteIncompleta)
const randomSample = [...clean].sort(() => Math.random() - 0.5).slice(0, 60)
const sampleRows = [...wrapped, ...incompletas, ...randomSample].sort((a, b) => a.linhaOrigem - b.linhaOrigem)

const csvHeader = 'codigo,procedimento,secao,porte,custo_operacional,numero_auxiliares,porte_anestesico,wasWrapped,fonteIncompleta,linhaOrigem'
const csvLines = sampleRows.map((r) =>
  [r.codigo, `"${r.procedimento.replace(/"/g, '""')}"`, `"${(r.secao || '').replace(/"/g, '""')}"`, r.porte,
    r.custo_operacional ?? '', r.numero_auxiliares ?? '', r.porte_anestesico ?? '', r.wasWrapped, r.fonteIncompleta, r.linhaOrigem].join(',')
)
fs.writeFileSync(path.join(OUT_DIR, 'cbhpm-2018-cap3-sample.csv'), [csvHeader, ...csvLines].join('\n'))

console.log(JSON.stringify(report, null, 2))
console.log(`\nSaída: ${path.join(OUT_DIR, 'cbhpm-2018-cap3.json')}`)
console.log(`Amostra p/ conferência: ${path.join(OUT_DIR, 'cbhpm-2018-cap3-sample.csv')} (${sampleRows.length} linhas)`)
