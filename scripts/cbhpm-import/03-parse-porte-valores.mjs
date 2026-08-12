// Parser da tabela de valores de porte (comunicado oficial AMB, vigência 2020-2021).
// Uso: node scripts/cbhpm-import/03-parse-porte-valores.mjs

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TMP_DIR = path.join(__dirname, 'tmp')
const OUT_DIR = path.join(__dirname, 'output')
fs.mkdirSync(OUT_DIR, { recursive: true })

const raw = fs.readFileSync(path.join(TMP_DIR, 'porte-2020-2021.txt'), 'utf8')

const PORTE_VALOR_RE = /(\d{1,2}[A-C])\s+R\$\s*([\d.]+,\d{2})/g
const UCO_RE = /UCO\s*=\s*R\$\s*([\d.]+,\d{2})/

function toNumber(str) {
  return Number(str.replace(/\./g, '').replace(',', '.'))
}

const valores = {}
for (const m of raw.matchAll(PORTE_VALOR_RE)) {
  const [, codigo, valorStr] = m
  valores[codigo] = toNumber(valorStr)
}

const ucoMatch = UCO_RE.exec(raw)
const valorUco = ucoMatch ? toNumber(ucoMatch[1]) : null

const dataMatch = raw.match(/(\d{1,2}) de (\w+) de (\d{4})/)

const result = {
  versao: 'Porte 2020-2021',
  fonte_arquivo: 'Porte CBHPM 2020-2021.pdf',
  data_comunicado: dataMatch ? dataMatch[0] : null,
  valor_uco: valorUco,
  total_portes: Object.keys(valores).length,
  portes: valores,
}

fs.writeFileSync(path.join(OUT_DIR, 'porte-2020-2021.json'), JSON.stringify(result, null, 2))

console.log(`Portes extraídos: ${result.total_portes} (esperado: 42, de 1A a 14C)`)
console.log(`Valor UCO: R$ ${valorUco}`)
console.log(`Data do comunicado: ${result.data_comunicado}`)
console.log(`Saída: ${path.join(OUT_DIR, 'porte-2020-2021.json')}`)
