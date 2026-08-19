// Roda extração + parse + relatório para as 6 edições novas (tudo exceto 2018,
// já importada). Não importa nada no Supabase — só gera output/multi/{id}/
// para conferência antes do import (rodar 08-import-multi.mjs depois de
// aprovar).
// Uso: node scripts/cbhpm-import/06-run-all-editions.mjs

import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { EDITIONS, SOURCE_DIR } from './config/editions.mjs'
import { parseEdition, buildSample, toCsv } from './lib/parse-cap3.mjs'
import { parsePorteFile, parsePorteEmbedded, parsePorteMultiColuna } from './lib/parse-porte.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TMP_DIR = path.join(__dirname, 'tmp')
const OUT_DIR = path.join(__dirname, 'output', 'multi')

function extractText(pdfName, txtName) {
  const src = path.join(SOURCE_DIR, pdfName)
  const dst = path.join(TMP_DIR, txtName)
  if (fs.existsSync(dst)) return dst // reaproveita extração já feita (ex: durante a investigação)
  try {
    execFileSync('pdftotext', ['-layout', '-enc', 'UTF-8', src, dst], { stdio: 'pipe' })
  } catch (err) {
    console.warn(`Aviso ao extrair ${pdfName} (pode ser inofensivo): ${err.message}`)
  }
  return dst
}

function getPorteData(porteSource) {
  const txtName = porteSource.file.replace(/[^\w.-]/g, '_') + '.txt'
  const txtPath = extractText(porteSource.file, txtName)
  const raw = fs.readFileSync(txtPath, 'utf8')
  if (porteSource.type === 'file') return parsePorteFile(raw)
  if (porteSource.type === 'embedded') return parsePorteEmbedded(raw)
  if (porteSource.type === 'file-column') return parsePorteMultiColuna(raw, porteSource.column)
  throw new Error(`Tipo de fonte de porte desconhecido: ${porteSource.type}`)
}

const summary = []

for (const edition of EDITIONS) {
  console.log(`\n=== ${edition.versaoLabel} ===`)
  const editionOutDir = path.join(OUT_DIR, edition.id)
  fs.mkdirSync(editionOutDir, { recursive: true })

  const txtName = edition.sourcePdf.replace(/[^\w.-]/g, '_') + '.txt'
  const txtPath = extractText(edition.sourcePdf, txtName)
  const raw = fs.readFileSync(txtPath, 'utf8')

  let parsed
  try {
    parsed = parseEdition(raw, edition.versaoLabel)
  } catch (err) {
    console.error(`FALHA: ${err.message}`)
    summary.push({ id: edition.id, versao: edition.versaoLabel, erro: err.message })
    continue
  }

  const porteData = getPorteData(edition.porteSource)

  // Códigos de porte válidos: 1-14 + A/B/C (42 combinações). Qualquer porte
  // fora disso (ex: "0A", artefato de extração/OCR) é anulado em vez de
  // mantido — preferimos "não determinado" a um código de porte inexistente.
  const PORTE_VALIDO_RE = /^(?:1[0-4]|[1-9])[A-C]$/
  let porteInvalidoCount = 0
  for (const r of parsed.records) {
    if (r.porte && !PORTE_VALIDO_RE.test(r.porte)) {
      porteInvalidoCount++
      r.porte = null
      r.custo_operacional = null
      r.numero_auxiliares = null
      r.porte_anestesico = null
      r.fonteIncompleta = true
      r.porteInvalido = true
    }
  }
  if (porteInvalidoCount > 0) console.warn(`  ${porteInvalidoCount} porte(s) inválido(s) anulado(s) (ex: "0A")`)

  // Quarentena pontual: só na CBHPM 2016, a página do par "Terapia por ondas
  // de choque extracorpórea ... 1ª aplicação / reaplicações" (seções 3.07.30
  // e 3.07.32) tem extração de PDF corrompida — os valores de porte de UM
  // código aparecem deslocados para a linha física de OUTRO código vizinho
  // (confirmado comparando contra CBHPM 2014/2012/2010/2008, que renderizam a
  // mesma seção de forma limpa: 3.07.30.13-9 e 3.07.32.05-0 pegariam valores
  // que não são os seus). Mantido como "fonte incompleta" (Article IV — não
  // inventar dado a partir de uma extração que sabemos estar embaralhada
  // nessa página específica) em vez de descartar a melhoria geral do fix de
  // wrap para as outras 317 recuperações nas 6 edições.
  if (edition.id === '2016') {
    const QUARENTENA_2016 = new Set(['3.07.30.13-9', '3.07.32.05-0'])
    let quarentenaCount = 0
    for (const r of parsed.records) {
      if (QUARENTENA_2016.has(r.codigo) && r.porte !== null) {
        quarentenaCount++
        r.porte = null; r.custo_operacional = null; r.numero_auxiliares = null; r.porte_anestesico = null
        r.fonteIncompleta = true; r.paginaCorrompida = true
      }
    }
    if (quarentenaCount > 0) console.warn(`  ${quarentenaCount} registro(s) em quarentena (página com extração corrompida, ver comentário no código)`)
  }

  fs.writeFileSync(path.join(editionOutDir, 'procedimentos.json'), JSON.stringify(parsed.records, null, 2))
  fs.writeFileSync(path.join(editionOutDir, 'report.json'), JSON.stringify(parsed.report, null, 2))
  fs.writeFileSync(path.join(editionOutDir, 'porte-valores.json'), JSON.stringify(porteData, null, 2))
  fs.writeFileSync(path.join(editionOutDir, 'sample.csv'), toCsv(buildSample(parsed.records)))

  // Integridade: todo porte usado deve existir na tabela de valores dessa edição
  const portesFaltando = new Set()
  for (const r of parsed.records) {
    if (r.porte && !(r.porte in porteData.portes)) portesFaltando.add(r.porte)
  }

  const completos = parsed.records.length - parsed.report.totalFonteIncompleta
  console.log(`Total: ${parsed.records.length} | Completos: ${completos} | Fonte incompleta: ${parsed.report.totalFonteIncompleta} (${parsed.report.totalSemPorte} sem porte) | Erros: ${parsed.report.totalParseErrors} | Notas: ${parsed.report.totalNotesSkipped}`)
  console.log(`Portes extraídos: ${Object.keys(porteData.portes).length}/42 | UCO: R$ ${porteData.valorUco} | Portes sem valor correspondente: ${portesFaltando.size ? [...portesFaltando].join(', ') : 'nenhum'}`)

  summary.push({
    id: edition.id,
    versao: edition.versaoLabel,
    total: parsed.records.length,
    completos,
    fonteIncompleta: parsed.report.totalFonteIncompleta,
    semPorte: parsed.report.totalSemPorte,
    erros: parsed.report.totalParseErrors,
    notas: parsed.report.totalNotesSkipped,
    portesExtraidos: Object.keys(porteData.portes).length,
    valorUco: porteData.valorUco,
    portesFaltando: [...portesFaltando],
  })
}

fs.writeFileSync(path.join(OUT_DIR, 'summary.json'), JSON.stringify(summary, null, 2))
console.log('\n\n=== RESUMO CONSOLIDADO ===')
console.table(summary.map(({ portesFaltando, ...rest }) => rest))
