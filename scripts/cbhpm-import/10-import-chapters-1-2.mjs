// Importa os Capítulos 1 e 2 de todas as edições para o Supabase, a partir
// de output/chapters/{id}/, gerado por 09-run-chapters-1-2.mjs.
// Exige output/chapters/APPROVED.txt.
// Uso: node scripts/cbhpm-import/10-import-chapters-1-2.mjs

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { EDITIONS } from './config/editions.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.join(__dirname, '..', '..')
const OUT_DIR = path.join(__dirname, 'output', 'chapters')

// Inclui 2018
const ALL_EDITIONS = [
  ...EDITIONS,
  {
    id: '2018',
    versaoLabel: 'CBHPM 2018',
    sourcePdf: 'CBHPM 2018.pdf',
    auxPct: [0.6, 0.4, 0.3, 0.3],
  },
]

function loadEnvLocal() {
  const envPath = path.join(PROJECT_ROOT, '.env.local')
  if (!fs.existsSync(envPath)) {
    console.error(`Arquivo não encontrado: ${envPath}`)
    process.exit(1)
  }
  const content = fs.readFileSync(envPath, 'utf8')
  for (const line of content.split(/\r?\n/)) {
    const m = /^\s*([\w.]+)\s*=\s*(.*)?$/.exec(line)
    if (!m) continue
    const key = m[1]
    let value = (m[2] || '').trim()
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1)
    if (!(key in process.env)) process.env[key] = value
  }
}

loadEnvLocal()

if (!fs.existsSync(path.join(OUT_DIR, 'APPROVED.txt'))) {
  console.error('BLOQUEADO: output/chapters/APPROVED.txt não existe. Aprove antes do import.')
  process.exit(1)
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !supabaseKey) {
  console.error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ausentes em .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// Carrega portes já importados da tabela cbhpm_porte_valores
async function loadPorteValues(versaoLabel) {
  const { data, error } = await supabase
    .from('cbhpm_porte_valores')
    .select('codigo_porte, valor')
    .eq('versao', versaoLabel)
  if (error) {
    console.warn(`  Aviso: não conseguiu carregar portes para ${versaoLabel}: ${error.message}`)
    return {}
  }
  const map = {}
  for (const row of data || []) {
    map[row.codigo_porte] = row.valor
  }
  return map
}

// Carrega UCO da tabela cbhpm_versoes
async function loadUcoValue(versaoLabel) {
  const { data, error } = await supabase
    .from('cbhpm_versoes')
    .select('valor_uco')
    .eq('versao', versaoLabel)
    .single()
  if (error || !data) {
    console.warn(`  Aviso: não conseguiu carregar UCO para ${versaoLabel}`)
    return null
  }
  return data.valor_uco
}

async function importChapter(edition, capNum) {
  const dir = path.join(OUT_DIR, edition.id)
  const filePath = path.join(dir, `cap${capNum}.json`)
  if (!fs.existsSync(filePath)) {
    console.log(`  Cap.${capNum}: arquivo não encontrado — pulando`)
    return 0
  }

  const records = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  if (records.length === 0) {
    console.log(`  Cap.${capNum}: 0 registros — pulando`)
    return 0
  }

  const portes = await loadPorteValues(edition.versaoLabel)
  const valorUco = await loadUcoValue(edition.versaoLabel)

  const procedureRows = records.map((r) => ({
    codigo: r.codigo,
    procedimento: r.procedimento,
    porte: r.porte,
    valor_porte: r.porte ? portes[r.porte] ?? null : null,
    uco: r.custo_operacional,
    valor_uco: r.custo_operacional !== null && valorUco !== null
      ? r.custo_operacional * valorUco
      : null,
    versao: r.versao,
    capitulo: r.capitulo,
    numero_auxiliares: r.numero_auxiliares,
    porte_anestesico: r.porte_anestesico,
    custo_operacional: r.custo_operacional,
    valor_versao: edition.versaoLabel,
    aux_pct: edition.auxPct ?? null,
  }))

  const BATCH = 500
  let inseridos = 0
  for (let i = 0; i < procedureRows.length; i += BATCH) {
    const batch = procedureRows.slice(i, i + BATCH)
    const { error } = await supabase.from('cbhpm_procedures').upsert(batch, { onConflict: 'codigo,versao' })
    if (error) throw error
    inseridos += batch.length
  }
  console.log(`  Cap.${capNum}: ${inseridos} procedimentos importados`)
  return inseridos
}

async function main() {
  let totalGeral = 0
  for (const edition of ALL_EDITIONS) {
    console.log(`\n=== ${edition.versaoLabel} ===`)
    totalGeral += await importChapter(edition, 1)
    totalGeral += await importChapter(edition, 2)
  }
  console.log(`\nImport concluído: ${totalGeral} procedimentos (Cap.1 + Cap.2) em ${ALL_EDITIONS.length} edições.`)
}

main().catch((err) => {
  console.error('Falha no import:', err)
  process.exit(1)
})
