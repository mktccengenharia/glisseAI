// Importa as 6 edições novas (tudo exceto 2018, que já está no banco e é
// corrigida por 07-fix-2018-porte.mjs) a partir de output/multi/{id}/, gerado
// por 06-run-all-editions.mjs. Exige output/multi/APPROVED.txt.
// Uso: node scripts/cbhpm-import/08-import-multi.mjs

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { EDITIONS } from './config/editions.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.join(__dirname, '..', '..')
const OUT_DIR = path.join(__dirname, 'output', 'multi')

function loadEnvLocal() {
  const envPath = path.join(PROJECT_ROOT, '.env.local')
  if (!fs.existsSync(envPath)) {
    console.error(`Arquivo não encontrado: ${envPath}`)
    process.exit(1)
  }
  const content = fs.readFileSync(envPath, 'utf8')
  for (const line of content.split(/\r?\n/)) {
    const m = /^\s*([\w.]+)\s*=\s*(.*)?\s*$/.exec(line)
    if (!m) continue
    const key = m[1]
    let value = (m[2] || '').trim()
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1)
    if (!(key in process.env)) process.env[key] = value
  }
}

loadEnvLocal()

if (!fs.existsSync(path.join(OUT_DIR, 'APPROVED.txt'))) {
  console.error('BLOQUEADO: output/multi/APPROVED.txt não existe. Aprove antes do import.')
  process.exit(1)
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !supabaseKey) {
  console.error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ausentes em .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function importEdition(edition) {
  const dir = path.join(OUT_DIR, edition.id)
  const records = JSON.parse(fs.readFileSync(path.join(dir, 'procedimentos.json'), 'utf8'))
  const porteData = JSON.parse(fs.readFileSync(path.join(dir, 'porte-valores.json'), 'utf8'))

  console.log(`\n=== ${edition.versaoLabel} ===`)

  const { error: errVersoes } = await supabase.from('cbhpm_versoes').upsert({
    versao: edition.versaoLabel,
    fonte_arquivo: edition.sourcePdf,
    valor_uco: porteData.valorUco,
    aux_pct: edition.auxPct,
  }, { onConflict: 'versao' })
  if (errVersoes) throw errVersoes

  const porteRows = Object.entries(porteData.portes).map(([codigo_porte, valor]) => ({
    versao: edition.versaoLabel,
    codigo_porte,
    valor,
  }))
  const { error: errPortes } = await supabase.from('cbhpm_porte_valores').upsert(porteRows, { onConflict: 'versao,codigo_porte' })
  if (errPortes) throw errPortes

  const procedureRows = records.map((r) => ({
    codigo: r.codigo,
    procedimento: r.procedimento,
    porte: r.porte,
    valor_porte: r.porte ? porteData.portes[r.porte] ?? null : null,
    uco: r.custo_operacional,
    valor_uco: r.custo_operacional !== null ? r.custo_operacional * porteData.valorUco : null,
    versao: r.versao,
    capitulo: r.capitulo,
    numero_auxiliares: r.numero_auxiliares,
    porte_anestesico: r.porte_anestesico,
    custo_operacional: r.custo_operacional,
    valor_versao: edition.versaoLabel,
    aux_pct: edition.auxPct,
  }))

  const BATCH = 500
  let inseridos = 0
  for (let i = 0; i < procedureRows.length; i += BATCH) {
    const batch = procedureRows.slice(i, i + BATCH)
    const { error } = await supabase.from('cbhpm_procedures').upsert(batch, { onConflict: 'codigo,versao' })
    if (error) throw error
    inseridos += batch.length
  }
  console.log(`${inseridos} procedimentos, ${porteRows.length} valores de porte.`)
  return inseridos
}

async function main() {
  let total = 0
  for (const edition of EDITIONS) {
    total += await importEdition(edition)
  }
  console.log(`\nImport concluído: ${total} procedimentos em ${EDITIONS.length} edições.`)
}

main().catch((err) => {
  console.error('Falha no import:', err)
  process.exit(1)
})
