// Extração + parse dos 4 capítulos da CBHPM 2012 (fonte fornecida pelo
// usuário: tabela_cbhpm_edicao_2012.pdf + tabela_de_portes_uco.pdf,
// Comunicado Oficial CBHPM 18/10/2012). Não importa nada no Supabase — só
// gera output/2012/ para conferência manual antes do import (16-import-2012.mjs).
// Uso: node scripts/cbhpm-import/15-run-2012.mjs

import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { EDITIONS, SOURCE_DIR } from './config/editions.mjs'
import { parseCap1 } from './lib/parse-cap1.mjs'
import { parseCap2 } from './lib/parse-cap2.mjs'
import { parseEdition as parseCap3Edition, buildSample as buildSample3, toCsv as toCsv3 } from './lib/parse-cap3.mjs'
import { parseEdition as parseCap4Edition, buildSample as buildSample4, toCsv as toCsv4 } from './lib/parse-cap4.mjs'
import { parsePorteFile } from './lib/parse-porte.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TMP_DIR = path.join(__dirname, 'tmp')
const OUT_DIR = path.join(__dirname, 'output', '2012')
fs.mkdirSync(OUT_DIR, { recursive: true })

const edition = EDITIONS.find((e) => e.id === '2012')
if (!edition) throw new Error('Edição 2012 não encontrada em config/editions.mjs')

function extractText(pdfName, txtName, mode) {
  const src = path.join(SOURCE_DIR, pdfName)
  const dst = path.join(TMP_DIR, txtName)
  if (fs.existsSync(dst)) return dst
  const args = mode === 'table' ? ['-table', '-enc', 'UTF-8', src, dst] : ['-layout', '-enc', 'UTF-8', src, dst]
  try {
    execFileSync('pdftotext', args, { stdio: 'pipe' })
  } catch (err) {
    console.warn(`Aviso ao extrair ${pdfName} (pode ser inofensivo): ${err.message}`)
  }
  return dst
}

// ── Valores de porte ──
const porteTxtName = edition.porteSource.file.replace(/[^\w.-]/g, '_') + '.txt'
const porteTxtPath = extractText(edition.porteSource.file, porteTxtName, 'layout')
const porteData = parsePorteFile(fs.readFileSync(porteTxtPath, 'utf8'))
fs.writeFileSync(path.join(OUT_DIR, 'porte-valores.json'), JSON.stringify(porteData, null, 2))
console.log(`Portes: ${Object.keys(porteData.portes).length}/42 | UCO: R$ ${porteData.valorUco}`)

// ── Texto -layout (Capítulos 1-3) ──
const layoutTxtName = edition.sourcePdf.replace(/[^\w.-]/g, '_') + '.txt'
const layoutTxtPath = extractText(edition.sourcePdf, layoutTxtName, 'layout')
const rawLayout = fs.readFileSync(layoutTxtPath, 'utf8')

// ── Texto -table (Capítulo 4) ──
const tableTxtName = edition.sourcePdf.replace(/[^\w.-]/g, '_') + '_table.txt'
const tableTxtPath = extractText(edition.sourcePdf, tableTxtName, 'table')
const rawTable = fs.readFileSync(tableTxtPath, 'utf8')

const summary = {}

// Cap 1
const r1 = parseCap1(rawLayout, edition.versaoLabel)
fs.writeFileSync(path.join(OUT_DIR, 'cap1.json'), JSON.stringify(r1.records, null, 2))
fs.writeFileSync(path.join(OUT_DIR, 'cap1-report.json'), JSON.stringify(r1.report, null, 2))
summary.cap1 = { total: r1.records.length, erros: r1.report.totalParseErrors, wrap: r1.report.totalWrapped, dup: r1.report.totalDuplicates }
console.log(`Cap1: ${r1.records.length} | erros: ${r1.report.totalParseErrors} | wrap: ${r1.report.totalWrapped}`)

// Cap 2
const r2 = parseCap2(rawLayout, edition.versaoLabel)
fs.writeFileSync(path.join(OUT_DIR, 'cap2.json'), JSON.stringify(r2.records, null, 2))
fs.writeFileSync(path.join(OUT_DIR, 'cap2-report.json'), JSON.stringify(r2.report, null, 2))
summary.cap2 = { total: r2.records.length, erros: r2.report.totalParseErrors, wrap: r2.report.totalWrapped, dup: r2.report.totalDuplicates }
console.log(`Cap2: ${r2.records.length} | erros: ${r2.report.totalParseErrors} | wrap: ${r2.report.totalWrapped}`)

// Cap 3 (com validação de porte, igual 06-run-all-editions.mjs)
const r3 = parseCap3Edition(rawLayout, edition.versaoLabel)
const PORTE_VALIDO_RE = /^(?:1[0-4]|[1-9])[A-C]$/
let porteInvalidoCount = 0
for (const r of r3.records) {
  if (r.porte && !PORTE_VALIDO_RE.test(r.porte)) {
    porteInvalidoCount++
    r.porte = null; r.custo_operacional = null; r.numero_auxiliares = null; r.porte_anestesico = null
    r.fonteIncompleta = true; r.porteInvalido = true
  }
}
const portesFaltandoCap3 = new Set()
for (const r of r3.records) if (r.porte && !(r.porte in porteData.portes)) portesFaltandoCap3.add(r.porte)
fs.writeFileSync(path.join(OUT_DIR, 'cap3.json'), JSON.stringify(r3.records, null, 2))
fs.writeFileSync(path.join(OUT_DIR, 'cap3-report.json'), JSON.stringify(r3.report, null, 2))
fs.writeFileSync(path.join(OUT_DIR, 'cap3-sample.csv'), toCsv3(buildSample3(r3.records)))
summary.cap3 = {
  total: r3.records.length,
  completos: r3.records.length - r3.report.totalFonteIncompleta,
  fonteIncompleta: r3.report.totalFonteIncompleta,
  semPorte: r3.report.totalSemPorte,
  erros: r3.report.totalParseErrors,
  dup: r3.report.totalDuplicates,
  porteInvalido: porteInvalidoCount,
  portesFaltando: [...portesFaltandoCap3],
}
console.log(`Cap3: ${r3.records.length} | completos: ${summary.cap3.completos} | fonteIncompleta: ${r3.report.totalFonteIncompleta} | erros: ${r3.report.totalParseErrors} | porteInvalido: ${porteInvalidoCount} | portesFaltando: ${summary.cap3.portesFaltando.join(', ') || 'nenhum'}`)

// Cap 4
const r4 = parseCap4Edition(rawTable, edition.versaoLabel)
const portesFaltandoCap4 = new Set()
for (const r of r4.records) if (r.porte && !(r.porte in porteData.portes)) portesFaltandoCap4.add(r.porte)
fs.writeFileSync(path.join(OUT_DIR, 'cap4.json'), JSON.stringify(r4.records, null, 2))
fs.writeFileSync(path.join(OUT_DIR, 'cap4-report.json'), JSON.stringify(r4.report, null, 2))
fs.writeFileSync(path.join(OUT_DIR, 'cap4-sample.csv'), toCsv4(buildSample4(r4.records)))
summary.cap4 = {
  total: r4.records.length,
  fonteIncompleta: r4.report.totalFonteIncompleta,
  semPorte: r4.report.totalSemPorte,
  erros: r4.report.totalParseErrors,
  dup: r4.report.totalDuplicates,
  portesFaltando: [...portesFaltandoCap4],
  registrosPorSchema: r4.report.registrosPorSchema,
}
console.log(`Cap4: ${r4.records.length} | fonteIncompleta: ${r4.report.totalFonteIncompleta} | erros: ${r4.report.totalParseErrors} | dup: ${r4.report.totalDuplicates} | portesFaltando: ${summary.cap4.portesFaltando.join(', ') || 'nenhum'}`)

fs.writeFileSync(path.join(OUT_DIR, 'summary.json'), JSON.stringify(summary, null, 2))

const totalGeral = r1.records.length + r2.records.length + r3.records.length + r4.records.length
console.log(`\nTOTAL GERAL (4 capítulos): ${totalGeral} procedimentos`)
