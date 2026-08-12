// Extrai o texto bruto dos PDFs fonte via `pdftotext -layout` (poppler-utils).
// Uso: node scripts/cbhpm-import/01-extract-text.mjs

import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TMP_DIR = path.join(__dirname, 'tmp')
const SOURCE_DIR = 'C:\\Users\\carme\\OneDrive\\Documentos\\JOHN\\tabelas_cbhpm\\tabelas_cbhpm'

const FILES = [
  { src: 'CBHPM 2018.pdf', out: 'cbhpm-2018.txt' },
  { src: 'Porte CBHPM 2020-2021.pdf', out: 'porte-2020-2021.txt' },
]

for (const { src, out } of FILES) {
  const srcPath = path.join(SOURCE_DIR, src)
  const outPath = path.join(TMP_DIR, out)
  console.log(`Extraindo: ${src} -> ${out}`)
  try {
    execFileSync('pdftotext', ['-layout', '-enc', 'UTF-8', srcPath, outPath], { stdio: 'inherit' })
  } catch (err) {
    // pdftotext retorna warning "Unknown filter 'Crypt'" em alguns PDFs protegidos,
    // mas ainda assim extrai o texto corretamente — não tratamos como falha fatal.
    console.warn(`Aviso ao extrair ${src} (pode ser inofensivo): ${err.message}`)
  }
}

console.log('Extração concluída.')
