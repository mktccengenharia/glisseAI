// Extrai (pdftotext -table) e faz o parse do Capítulo 4 para as 7 edições da
// CBHPM. Gera output/cbhpm-{edicao}-cap4.json + relatório agregado. NÃO
// importa nada no Supabase — isso é feito por 14-import-cap4.mjs, após
// revisão do relatório abaixo.
//
// Uso: node scripts/cbhpm-import/13-run-all-editions-cap4.mjs

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { EDITIONS, SOURCE_DIR } from './config/editions.mjs'
import { parseEdition } from './lib/parse-cap4.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_DIR = path.join(__dirname, 'output')
fs.mkdirSync(OUT_DIR, { recursive: true })

// 2018 não está em EDITIONS (config específica de import de valores de
// porte, que não se aplica aqui — o Capítulo 4 só precisa do PDF de
// procedimentos, igual aos Capítulos 1-3).
const ALL_EDITIONS = [
  ...EDITIONS.map((e) => ({ id: e.id, versaoLabel: e.versaoLabel, sourcePdf: e.sourcePdf })),
  { id: '2018', versaoLabel: 'CBHPM 2018', sourcePdf: 'CBHPM 2018.pdf' },
]

const summary = []

for (const { id, versaoLabel, sourcePdf } of ALL_EDITIONS) {
  const srcPath = path.join(SOURCE_DIR, sourcePdf)
  console.log(`\n=== ${versaoLabel} (${sourcePdf}) ===`)

  let raw
  try {
    raw = execFileSync('pdftotext', ['-table', '-enc', 'UTF-8', srcPath, '-'], { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 })
  } catch (err) {
    if (!err.stdout) {
      console.error(`FALHA na extração de ${sourcePdf}: ${err.message}`)
      summary.push({ id, versaoLabel, erro: `extração falhou: ${err.message}` })
      continue
    }
    raw = err.stdout
  }

  let records, report
  try {
    ;({ records, report } = parseEdition(raw, versaoLabel))
  } catch (err) {
    console.error(`FALHA no parse de ${versaoLabel}: ${err.message}`)
    summary.push({ id, versaoLabel, erro: `parse falhou: ${err.message}` })
    continue
  }

  fs.writeFileSync(path.join(OUT_DIR, `cbhpm-${id}-cap4.json`), JSON.stringify(records, null, 2))
  fs.writeFileSync(path.join(OUT_DIR, `cbhpm-${id}-cap4-report.json`), JSON.stringify(report, null, 2))

  console.log(`  Registros: ${report.totalRegistrosParseados} | semPorte: ${report.totalSemPorte} | fonteIncompleta: ${report.totalFonteIncompleta} | erros: ${report.totalParseErrors} | duplicatas: ${report.totalDuplicates} | headers vistos: ${report.totalUnknownHeaders}`)

  summary.push({
    id,
    versaoLabel,
    totalRegistros: report.totalRegistrosParseados,
    semPorte: report.totalSemPorte,
    fonteIncompleta: report.totalFonteIncompleta,
    parseErrors: report.totalParseErrors,
    duplicates: report.totalDuplicates,
    unknownHeaders: report.totalUnknownHeaders,
    registrosPorSchema: report.registrosPorSchema,
  })
}

fs.writeFileSync(path.join(OUT_DIR, 'cap4-summary-all-editions.json'), JSON.stringify(summary, null, 2))

console.log('\n\n=== RESUMO GERAL ===')
console.table(summary.map(({ registrosPorSchema, ...rest }) => rest))
