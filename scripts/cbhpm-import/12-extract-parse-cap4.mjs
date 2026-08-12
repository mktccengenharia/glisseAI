// Extrai (via `pdftotext -table`, ver lib/parse-cap4.mjs para o motivo) e
// faz o parse do Capítulo 4 (Procedimentos Diagnósticos e Terapêuticos) da
// edição 2018 — mesmo padrão usado para validar o Capítulo 3 antes de
// templatizar para as demais edições. Gera amostra CSV para conferência
// humana; NÃO importa nada no Supabase.
//
// Uso: node scripts/cbhpm-import/12-extract-parse-cap4.mjs

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { SOURCE_DIR } from './config/editions.mjs'
import { parseEdition, buildSample, toCsv } from './lib/parse-cap4.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_DIR = path.join(__dirname, 'output')
fs.mkdirSync(OUT_DIR, { recursive: true })

const SRC_PDF = path.join(SOURCE_DIR, 'CBHPM 2018.pdf')
const VERSAO = 'CBHPM 2018'

console.log(`Extraindo (pdftotext -table) de: ${SRC_PDF}`)
let raw
try {
  raw = execFileSync('pdftotext', ['-table', '-enc', 'UTF-8', SRC_PDF, '-'], { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 })
} catch (err) {
  // "Unknown filter 'Crypt'" é warning inofensivo em alguns PDFs protegidos, mas
  // ainda produz stdout válido — só falha de verdade se não houver stdout.
  if (!err.stdout) throw err
  raw = err.stdout
  console.warn(`Aviso ao extrair (pode ser inofensivo): ${err.message}`)
}

const { records, report } = parseEdition(raw, VERSAO)

console.log('\n=== Relatório de parsing — Capítulo 4 ===')
console.log(JSON.stringify(report, null, 2))

fs.writeFileSync(path.join(OUT_DIR, 'cbhpm-2018-cap4.json'), JSON.stringify(records, null, 2))
fs.writeFileSync(path.join(OUT_DIR, 'cbhpm-2018-cap4-report.json'), JSON.stringify(report, null, 2))

const sample = buildSample(records)
fs.writeFileSync(path.join(OUT_DIR, 'cbhpm-2018-cap4-sample.csv'), toCsv(sample))

console.log(`\nGravado: output/cbhpm-2018-cap4.json (${records.length} registros)`)
console.log(`Gravado: output/cbhpm-2018-cap4-sample.csv (${sample.length} linhas para conferência humana)`)
