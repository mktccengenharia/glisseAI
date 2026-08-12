// Importa o Capítulo 4 (todas as 7 edições) para o Supabase, a partir de
// output/cbhpm-{id}-cap4.json, gerado por 13-run-all-editions-cap4.mjs.
//
// custo_operacional é um MULTIPLICADOR de UCO (não R$ direto) — mesma
// convenção usada nos Capítulos 1-3 (ver 10-import-chapters-1-2.mjs):
// valor_uco = custo_operacional × valor_uco_da_edição.
//
// custo_filme_doc, numero_incidencias e unidade_radiofarmaco são gravados
// como valores BRUTOS da fonte, sem nenhuma conversão — a própria CBHPM
// (seção "INSTRUÇÕES ESPECÍFICAS PARA MEDICINA NUCLEAR") diz que o consumo
// de filme/documentação é "calculado por índice atualizado pelo Colégio
// Brasileiro de Radiologia", uma tabela EXTERNA que não temos. Apresentar
// um valor em R$ calculado a partir disso seria inventar dado sem fonte.
//
// Uso: node scripts/cbhpm-import/14-import-cap4.mjs

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { EDITIONS } from './config/editions.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.join(__dirname, '..', '..')
const OUT_DIR = path.join(__dirname, 'output')

const ALL_EDITIONS = [
  ...EDITIONS,
  { id: '2018', versaoLabel: 'CBHPM 2018', sourcePdf: 'CBHPM 2018.pdf', auxPct: [0.6, 0.4, 0.3, 0.3] },
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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !supabaseKey) {
  console.error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ausentes em .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

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
  for (const row of data || []) map[row.codigo_porte] = row.valor
  return map
}

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

async function importEdition(edition) {
  const filePath = path.join(OUT_DIR, `cbhpm-${edition.id}-cap4.json`)
  if (!fs.existsSync(filePath)) {
    console.log(`  ${edition.versaoLabel}: arquivo não encontrado — pulando`)
    return 0
  }

  const records = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  if (records.length === 0) {
    console.log(`  ${edition.versaoLabel}: 0 registros — pulando`)
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
    custo_filme_doc: r.custo_filme_doc,
    numero_incidencias: r.numero_incidencias,
    unidade_radiofarmaco: r.unidade_radiofarmaco,
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
  console.log(`  ${edition.versaoLabel}: ${inseridos} procedimentos importados`)
  return inseridos
}

async function main() {
  let totalGeral = 0
  for (const edition of ALL_EDITIONS) {
    totalGeral += await importEdition(edition)
  }
  console.log(`\nImport concluído: ${totalGeral} procedimentos (Cap.4) em ${ALL_EDITIONS.length} edições.`)
}

main().catch((err) => {
  console.error('Falha no import:', err)
  process.exit(1)
})
