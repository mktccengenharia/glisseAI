// Importa os dados validados (Capítulo 3, CBHPM 2018) para o Supabase.
// Só roda manualmente, nunca em build/deploy. Exige output/APPROVED.txt.
// Uso: node scripts/cbhpm-import/05-import-to-supabase.mjs

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.join(__dirname, '..', '..')
const OUT_DIR = path.join(__dirname, 'output')

// ─── Carrega .env.local (script standalone, fora do runtime do Next.js) ────

function loadEnvLocal() {
  const envPath = path.join(PROJECT_ROOT, '.env.local')
  if (!fs.existsSync(envPath)) {
    console.error(`Arquivo não encontrado: ${envPath}`)
    console.error('Crie .env.local com NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY antes de rodar o import.')
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
  console.error('BLOQUEADO: output/APPROVED.txt não existe. Rode 04-validate.mjs e aprove antes do import.')
  process.exit(1)
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !supabaseKey) {
  console.error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ausentes em .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

const records = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'cbhpm-2018-cap3.json'), 'utf8'))
const porteData = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'porte-2020-2021.json'), 'utf8'))

// Importa todos os registros parseados, inclusive os "fonteIncompleta" (porte
// determinado, mas aux/anest/custo ausentes na fonte — muitos são casos onde o
// conceito de auxiliar/porte anestésico genuinamente não se aplica, ex:
// procedimentos extracorpóreos, não é falha de extração). O RAG e a UI já
// tratam null como "não consta na fonte", nunca como 0 — seguro importar.
const completos = records
console.log(`Registros a importar: ${completos.length} de ${records.length}`)

async function main() {
  // 1) cbhpm_versoes
  const [dia, , mes, , ano] = porteData.data_comunicado?.split(' ') ?? []
  const MESES = { janeiro: '01', fevereiro: '02', março: '03', abril: '04', maio: '05', junho: '06',
    julho: '07', agosto: '08', setembro: '09', outubro: '10', novembro: '11', dezembro: '12' }
  const vigenciaInicio = ano && mes ? `${ano}-${MESES[mes.toLowerCase()] ?? '01'}-${dia.padStart(2, '0')}` : null

  console.log('Upsert cbhpm_versoes...')
  const { error: errVersoes } = await supabase.from('cbhpm_versoes').upsert({
    versao: porteData.versao,
    vigencia_inicio: vigenciaInicio,
    fonte_arquivo: porteData.fonte_arquivo,
    valor_uco: porteData.valor_uco,
  }, { onConflict: 'versao' })
  if (errVersoes) throw errVersoes

  // 2) cbhpm_porte_valores
  console.log('Upsert cbhpm_porte_valores...')
  const porteRows = Object.entries(porteData.portes).map(([codigo_porte, valor]) => ({
    versao: porteData.versao,
    codigo_porte,
    valor,
  }))
  const { error: errPortes } = await supabase.from('cbhpm_porte_valores').upsert(porteRows, { onConflict: 'versao,codigo_porte' })
  if (errPortes) throw errPortes

  // 3) cbhpm_procedures — calcula valor_porte/valor_uco a partir da tabela de porte
  console.log('Upsert cbhpm_procedures...')
  const procedureRows = completos.map((r) => ({
    codigo: r.codigo,
    procedimento: r.procedimento,
    porte: r.porte,
    valor_porte: r.porte ? porteData.portes[r.porte] ?? null : null,
    uco: r.custo_operacional,
    valor_uco: r.custo_operacional !== null ? r.custo_operacional * porteData.valor_uco : null,
    versao: r.versao,
    capitulo: r.capitulo,
    numero_auxiliares: r.numero_auxiliares,
    porte_anestesico: r.porte_anestesico,
    custo_operacional: r.custo_operacional,
    valor_versao: porteData.versao,
  }))

  const BATCH = 500
  let inseridos = 0
  for (let i = 0; i < procedureRows.length; i += BATCH) {
    const batch = procedureRows.slice(i, i + BATCH)
    const { error } = await supabase.from('cbhpm_procedures').upsert(batch, { onConflict: 'codigo,versao' })
    if (error) throw error
    inseridos += batch.length
    console.log(`  ${inseridos}/${procedureRows.length}`)
  }

  console.log(`\nImport concluído: ${inseridos} procedimentos, ${porteRows.length} valores de porte, 1 versão.`)
}

main().catch((err) => {
  console.error('Falha no import:', err)
  process.exit(1)
})
