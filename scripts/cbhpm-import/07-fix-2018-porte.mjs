// Corrige os 2.397 procedimentos da CBHPM 2018 já importados: trocam de
// "Porte CBHPM 2020-2021.pdf" (vigência errada, usada por engano no import
// original) para "PORTE CBHPM 2018.pdf" (vigência contemporânea correta,
// 2017-2018, UCO R$20,47). Também popula aux_pct=[0.6,0.4,0.3,0.3] (coluna
// nova, não existia no import original).
// Uso: node scripts/cbhpm-import/07-fix-2018-porte.mjs

import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { parsePorteFile } from './lib/parse-porte.mjs'
import { SOURCE_DIR } from './config/editions.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.join(__dirname, '..', '..')
const TMP_DIR = path.join(__dirname, 'tmp')
const OUT_DIR = path.join(__dirname, 'output')

function loadEnvLocal() {
  const envPath = path.join(PROJECT_ROOT, '.env.local')
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
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const AUX_PCT_2018 = [0.6, 0.4, 0.3, 0.3]
const VERSAO = 'CBHPM 2018'

async function main() {
  // 1) Extrai e parseia a tabela de porte contemporânea (2017-2018)
  const srcPdf = path.join(SOURCE_DIR, 'PORTE CBHPM 2018.pdf')
  const txtPath = path.join(TMP_DIR, 'porte-2018-contemporanea.txt')
  try {
    execFileSync('pdftotext', ['-layout', '-enc', 'UTF-8', srcPdf, txtPath], { stdio: 'pipe' })
  } catch (err) {
    console.warn(`Aviso na extração (pode ser inofensivo): ${err.message}`)
  }
  const raw = fs.readFileSync(txtPath, 'utf8')
  const porteData = parsePorteFile(raw)
  console.log(`Portes extraídos: ${Object.keys(porteData.portes).length}/42 | UCO: R$ ${porteData.valorUco}`)
  if (Object.keys(porteData.portes).length !== 42) {
    throw new Error('Extração da tabela de porte 2018 contemporânea incompleta — abortando antes de tocar no banco.')
  }

  // 2) Atualiza cbhpm_versoes
  const { error: errVersao } = await supabase.from('cbhpm_versoes').upsert({
    versao: VERSAO,
    fonte_arquivo: 'PORTE CBHPM 2018.pdf',
    valor_uco: porteData.valorUco,
    aux_pct: AUX_PCT_2018,
  }, { onConflict: 'versao' })
  if (errVersao) throw errVersao

  // 3) Substitui cbhpm_porte_valores da 2018 (delete + insert, já que os
  //    códigos de porte são os mesmos 42, só o valor muda)
  const { error: errDelPorte } = await supabase.from('cbhpm_porte_valores').delete().eq('versao', VERSAO)
  if (errDelPorte) throw errDelPorte
  const porteRows = Object.entries(porteData.portes).map(([codigo_porte, valor]) => ({ versao: VERSAO, codigo_porte, valor }))
  const { error: errInsPorte } = await supabase.from('cbhpm_porte_valores').insert(porteRows)
  if (errInsPorte) throw errInsPorte

  // 4) Recalcula valor_porte/valor_uco/aux_pct/valor_versao de cada procedimento
  //    já importado, reaproveitando o JSON já parseado (mesmos dados de
  //    porte/custo_operacional, só a fonte de R$ muda).
  const records = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'cbhpm-2018-cap3.json'), 'utf8'))
  const updateRows = records.map((r) => ({
    codigo: r.codigo,
    procedimento: r.procedimento,
    porte: r.porte,
    valor_porte: r.porte ? porteData.portes[r.porte] ?? null : null,
    uco: r.custo_operacional,
    valor_uco: r.custo_operacional !== null ? r.custo_operacional * porteData.valorUco : null,
    versao: VERSAO,
    capitulo: r.capitulo,
    numero_auxiliares: r.numero_auxiliares,
    porte_anestesico: r.porte_anestesico,
    custo_operacional: r.custo_operacional,
    valor_versao: VERSAO,
    aux_pct: AUX_PCT_2018,
  }))

  const BATCH = 500
  let atualizados = 0
  for (let i = 0; i < updateRows.length; i += BATCH) {
    const batch = updateRows.slice(i, i + BATCH)
    const { error } = await supabase.from('cbhpm_procedures').upsert(batch, { onConflict: 'codigo,versao' })
    if (error) throw error
    atualizados += batch.length
    console.log(`  ${atualizados}/${updateRows.length}`)
  }

  console.log(`\nCorreção concluída: ${atualizados} procedimentos da CBHPM 2018 recalculados com a vigência 2017-2018 (UCO R$ ${porteData.valorUco}) e aux_pct=${JSON.stringify(AUX_PCT_2018)}.`)
}

main().catch((err) => {
  console.error('Falha na correção:', err)
  process.exit(1)
})
