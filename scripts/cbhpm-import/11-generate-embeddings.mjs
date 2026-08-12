// Backfill de embeddings (busca semântica open source) para os procedimentos
// já importados. Roda localmente o modelo Xenova/multilingual-e5-small via
// @huggingface/transformers — sem API externa, sem custo por chamada, sem
// chave. Idempotente: só processa linhas com embedding ainda nulo, então
// pode ser interrompido e rodado de novo com segurança.
//
// Pré-requisito: aplicar a migration da seção 12 de supabase/schema.sql
// (extensão vector + coluna embedding + RPC) no SQL Editor do Supabase antes
// de rodar este script.
//
// Uso: node scripts/cbhpm-import/11-generate-embeddings.mjs

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { pipeline } from '@huggingface/transformers'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.join(__dirname, '..', '..')

// ─── Carrega .env.local (script standalone, fora do runtime do Next.js) ────

function loadEnvLocal() {
  const envPath = path.join(PROJECT_ROOT, '.env.local')
  if (!fs.existsSync(envPath)) {
    console.error(`Arquivo não encontrado: ${envPath}`)
    console.error('Crie .env.local com NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY antes de rodar.')
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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !supabaseKey) {
  console.error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ausentes em .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

const MODEL_ID = 'Xenova/multilingual-e5-small'
const PAGE_SIZE = 200

async function main() {
  console.log(`Carregando modelo ${MODEL_ID} (primeira vez baixa os pesos, pode levar um minuto)...`)
  const extractor = await pipeline('feature-extraction', MODEL_ID, { dtype: 'q8' })

  let totalProcessado = 0
  for (;;) {
    // Sempre busca a "próxima página" de linhas ainda sem embedding — como
    // o backfill acabou de preencher a página anterior, essa mesma query
    // naturalmente avança sem precisar de offset/range.
    const { data: rows, error } = await supabase
      .from('cbhpm_procedures')
      .select('*')
      .is('embedding', null)
      .limit(PAGE_SIZE)

    if (error) {
      if (error.message?.toLowerCase().includes('embedding')) {
        console.error('Coluna "embedding" não existe ainda. Aplique a migration da seção 12 de supabase/schema.sql no SQL Editor do Supabase antes de rodar este script.')
        process.exit(1)
      }
      throw error
    }

    if (!rows || rows.length === 0) break

    console.log(`Gerando embeddings para ${rows.length} procedimentos...`)
    const updated = []
    for (const row of rows) {
      const output = await extractor(`passage: ${row.procedimento}`, { pooling: 'mean', normalize: true })
      updated.push({ ...row, embedding: Array.from(output.data) })
    }

    const { error: upsertError } = await supabase
      .from('cbhpm_procedures')
      .upsert(updated, { onConflict: 'id' })
    if (upsertError) throw upsertError

    totalProcessado += updated.length
    console.log(`  Total processado: ${totalProcessado}`)
  }

  console.log(`\nBackfill concluído: ${totalProcessado} procedimentos com embedding gerado.`)
  if (totalProcessado > 0) {
    console.log('Recomendado: rodar `analyze cbhpm_procedures;` no SQL Editor para o índice ivfflat refletir o volume real de dados.')
  }
}

main().catch((err) => {
  console.error('Falha ao gerar embeddings:', err)
  process.exit(1)
})
