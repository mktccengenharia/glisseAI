// Roda extração + parse dos Capítulos 1 e 2 para todas as edições (incluindo
// 2018). Gera output/chapters/{id}/ para conferência antes do import.
// Uso: node scripts/cbhpm-import/09-run-chapters-1-2.mjs

import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { EDITIONS, SOURCE_DIR } from './config/editions.mjs'
import { parseCap1 } from './lib/parse-cap1.mjs'
import { parseCap2 } from './lib/parse-cap2.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TMP_DIR = path.join(__dirname, 'tmp')
const OUT_DIR = path.join(__dirname, 'output', 'chapters')

// Edição 2018 não está em EDITIONS (foi importada antes), adicionamos manualmente
const ALL_EDITIONS = [
  ...EDITIONS,
  {
    id: '2018',
    versaoLabel: 'CBHPM 2018',
    sourcePdf: 'CBHPM 2018.pdf',
    auxPct: [0.6, 0.4, 0.3, 0.3],
    vigencia: '2018',
    porteSource: { type: 'file', file: 'CBHPM 2018.pdf' }, // não usado aqui
  },
]

function extractText(pdfName, txtName) {
  const src = path.join(SOURCE_DIR, pdfName)
  const dst = path.join(TMP_DIR, txtName)
  if (fs.existsSync(dst)) return dst
  try {
    execFileSync('pdftotext', ['-layout', '-enc', 'UTF-8', src, dst], { stdio: 'pipe' })
  } catch (err) {
    console.warn(`Aviso ao extrair ${pdfName}: ${err.message}`)
  }
  return dst
}

// Mapa de edição → nome do arquivo txt já extraído (reutiliza os que já existem)
function getTxtPath(edition) {
  // Tenta encontrar um txt já existente no tmp
  const txtName = edition.sourcePdf.replace(/[^\w.-]/g, '_') + '.txt'
  const candidatos = [
    path.join(TMP_DIR, txtName),
    // A edição 2018 usa nome diferente
    ...(edition.id === '2018' ? [path.join(TMP_DIR, 'cbhpm-2018.txt')] : []),
    // 3ª edição também
    ...(edition.id === '3ed' ? [path.join(TMP_DIR, 'cbhpm-3ed.txt'), path.join(TMP_DIR, 'CBHPM_3__EDI__O.pdf.txt')] : []),
  ]
  for (const c of candidatos) {
    if (fs.existsSync(c)) return c
  }
  // Extrai se não encontrou
  return extractText(edition.sourcePdf, txtName)
}

function toCsv(records) {
  const header = 'codigo,procedimento,secao,capitulo,porte,custo_operacional,wasWrapped,fonteIncompleta,semPorte,linhaOrigem'
  const lines = records.map((r) =>
    [r.codigo, `"${r.procedimento.replace(/"/g, '""')}"`, `"${(r.secao || '').replace(/"/g, '""')}"`,
      `"${r.capitulo}"`, r.porte, r.custo_operacional ?? '', r.wasWrapped, r.fonteIncompleta, r.semPorte, r.linhaOrigem].join(',')
  )
  return [header, ...lines].join('\n')
}

const summary = []

for (const edition of ALL_EDITIONS) {
  console.log(`\n=== ${edition.versaoLabel} ===`)
  const editionOutDir = path.join(OUT_DIR, edition.id)
  fs.mkdirSync(editionOutDir, { recursive: true })

  const txtPath = getTxtPath(edition)
  if (!fs.existsSync(txtPath)) {
    console.error(`  ERRO: Arquivo de texto não encontrado: ${txtPath}`)
    summary.push({ id: edition.id, versao: edition.versaoLabel, erro: 'txt não encontrado' })
    continue
  }
  const raw = fs.readFileSync(txtPath, 'utf8')

  // ── Capítulo 1 ──
  let cap1Result = null
  try {
    cap1Result = parseCap1(raw, edition.versaoLabel)
    fs.writeFileSync(path.join(editionOutDir, 'cap1.json'), JSON.stringify(cap1Result.records, null, 2))
    fs.writeFileSync(path.join(editionOutDir, 'cap1-report.json'), JSON.stringify(cap1Result.report, null, 2))
    fs.writeFileSync(path.join(editionOutDir, 'cap1-sample.csv'), toCsv(cap1Result.records))
    console.log(`  Cap.1: ${cap1Result.records.length} procedimentos | Erros: ${cap1Result.report.totalParseErrors} | Wrap: ${cap1Result.report.totalWrapped}`)
  } catch (err) {
    console.error(`  Cap.1 FALHA: ${err.message}`)
  }

  // ── Capítulo 2 ──
  let cap2Result = null
  try {
    cap2Result = parseCap2(raw, edition.versaoLabel)
    fs.writeFileSync(path.join(editionOutDir, 'cap2.json'), JSON.stringify(cap2Result.records, null, 2))
    fs.writeFileSync(path.join(editionOutDir, 'cap2-report.json'), JSON.stringify(cap2Result.report, null, 2))
    fs.writeFileSync(path.join(editionOutDir, 'cap2-sample.csv'), toCsv(cap2Result.records))
    console.log(`  Cap.2: ${cap2Result.records.length} procedimentos | Erros: ${cap2Result.report.totalParseErrors} | Wrap: ${cap2Result.report.totalWrapped}`)
  } catch (err) {
    console.error(`  Cap.2 FALHA: ${err.message}`)
  }

  summary.push({
    id: edition.id,
    versao: edition.versaoLabel,
    cap1_total: cap1Result?.records.length ?? 0,
    cap1_erros: cap1Result?.report.totalParseErrors ?? '-',
    cap2_total: cap2Result?.records.length ?? 0,
    cap2_erros: cap2Result?.report.totalParseErrors ?? '-',
  })
}

fs.writeFileSync(path.join(OUT_DIR, 'summary.json'), JSON.stringify(summary, null, 2))
console.log('\n\n=== RESUMO CONSOLIDADO ===')
console.table(summary)
