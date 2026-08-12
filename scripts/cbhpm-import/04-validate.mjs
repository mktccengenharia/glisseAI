// Gate de QA — bloqueia o import até existir output/APPROVED.txt (criado manualmente
// depois da conferência humana da amostra CSV contra o PDF original).
// Uso: node scripts/cbhpm-import/04-validate.mjs

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_DIR = path.join(__dirname, 'output')

const records = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'cbhpm-2018-cap3.json'), 'utf8'))
const porteValores = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'porte-2020-2021.json'), 'utf8')).portes

const issues = []

// Duplicidade de código
const seen = new Set()
for (const r of records) {
  if (seen.has(r.codigo)) issues.push(`Código duplicado: ${r.codigo}`)
  seen.add(r.codigo)
}

// Integridade referencial (porte -> tabela de valores)
const portesFaltando = new Set()
for (const r of records) {
  if (r.porte && !(r.porte in porteValores)) portesFaltando.add(r.porte)
}
if (portesFaltando.size > 0) issues.push(`Portes sem valor correspondente: ${[...portesFaltando].join(', ')}`)

// Formato / faixas de valor
for (const r of records) {
  if (!/^\d\.\d{2}\.\d{2}\.\d{2}-\d$/.test(r.codigo)) issues.push(`Formato de código inválido: ${r.codigo}`)
  if (r.porte && !/^\d{1,2}[A-C]$/.test(r.porte)) issues.push(`Formato de porte inválido: ${r.codigo} -> ${r.porte}`)
  if (r.numero_auxiliares !== null && (r.numero_auxiliares < 0 || r.numero_auxiliares > 4)) {
    issues.push(`numero_auxiliares fora da faixa 0-4: ${r.codigo} -> ${r.numero_auxiliares}`)
  }
  if (r.porte_anestesico !== null && (r.porte_anestesico < 0 || r.porte_anestesico > 8)) {
    issues.push(`porte_anestesico fora da faixa 0-8: ${r.codigo} -> ${r.porte_anestesico}`)
  }
}

const totalFonteIncompleta = records.filter((r) => r.fonteIncompleta).length
const totalCompletos = records.length - totalFonteIncompleta

console.log(`Total de registros: ${records.length}`)
console.log(`  Completos (porte + custo + aux + anest determinados): ${totalCompletos}`)
console.log(`  Fonte incompleta (porte OK, aux/anest não impressos na fonte): ${totalFonteIncompleta}`)
console.log(`Problemas de formato/integridade encontrados: ${issues.length}`)
issues.forEach((i) => console.log(`  - ${i}`))

const approvedPath = path.join(OUT_DIR, 'APPROVED.txt')
const approved = fs.existsSync(approvedPath)

console.log(`\nGate de aprovação humana: ${approved ? 'APROVADO (' + approvedPath + ' existe)' : 'PENDENTE — crie output/APPROVED.txt após conferir a amostra CSV'}`)

if (issues.length > 0) {
  console.error('\nFALHA: existem problemas de integridade/formato — corrigir antes de aprovar.')
  process.exit(1)
}

if (!approved) {
  console.error('\nBLOQUEADO: import não deve rodar sem aprovação humana explícita.')
  process.exit(1)
}

console.log('\nOK — pronto para import.')
