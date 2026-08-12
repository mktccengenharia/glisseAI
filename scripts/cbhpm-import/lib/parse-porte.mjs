// Extrai tabelas de valores de porte em 3 formatos diferentes encontrados nos
// comunicados oficiais da CBHPM.

function toNumber(str) {
  return Number(str.replace(/\./g, '').replace(',', '.'))
}

// Formato simples: "1A R$ 224,90" (usado por porte 2008.pdf, porte 2015-2016.pdf,
// Porte CBHPM 2018.pdf, Porte CBHPM 2020-2021.pdf)
export function parsePorteFile(raw) {
  const PORTE_VALOR_RE = /(\d{1,2}[A-C])\s+R\$\s*([\d.]+,\d{2})/g
  const UCO_RE = /UCO\s*=\s*R\$\s*([\d.]+,\d{2})/
  const portes = {}
  for (const m of raw.matchAll(PORTE_VALOR_RE)) {
    portes[m[1]] = toNumber(m[2])
  }
  const ucoMatch = UCO_RE.exec(raw)
  return { portes, valorUco: ucoMatch ? toNumber(ucoMatch[1]) : null }
}

// Formato embutido no PDF de procedimentos da 3ª edição: "PO1A  R$ 8,00" /
// "P10B  R$ 608,00" (prefixo "PO" nos portes 1-9, "P" nos portes 10-14).
export function parsePorteEmbedded(raw) {
  const PORTE_VALOR_RE = /PO?(\d{1,2}[A-C])\s+R\$\s*([\d.]+,\d{2})/g
  const UCO_RE = /Custo Operacional.{0,20}?UCO\s*=\s*R\$\s*([\d.]+,\d{2})|UCO\s*=\s*R\$\s*([\d.]+,\d{2})/
  const portes = {}
  for (const m of raw.matchAll(PORTE_VALOR_RE)) {
    portes[m[1]] = toNumber(m[2])
  }
  const ucoMatch = UCO_RE.exec(raw)
  const ucoStr = ucoMatch ? (ucoMatch[1] || ucoMatch[2]) : null
  return { portes, valorUco: ucoStr ? toNumber(ucoStr) : null }
}

// Formato histórico multi-vigência (PORTES CBHPM.pdf): uma linha por porte com
// 5 valores em sequência (colunas 5ª/2008, 2010, 2012, 2014, 2017), nem sempre
// todos com o prefixo "R$" (o último costuma perder o prefixo na extração).
// columnIndex: 0=2008, 1=2010, 2=2012, 3=2014, 4=2017
const COLUNAS_UCO = [11.50, 12.67, 14.33, 16.15, 19.69]

export function parsePorteMultiColuna(raw, columnIndex) {
  const lines = raw.split(/\r?\n/)
  const ROW_RE = /^(\d{1,2}[A-C])\s+(.+)$/
  // Duas linhas da fonte (7B, 8B) têm a última coluna com só 1 casa decimal
  // ("627,2" em vez de "627,20") — aceitar 1 ou 2 dígitos após a vírgula.
  const VALOR_RE = /(?:R\$\s*)?([\d.]+,\d{1,2})/g
  const portes = {}
  for (const line of lines) {
    const m = ROW_RE.exec(line.trim())
    if (!m) continue
    const codigo = m[1]
    const valores = [...m[2].matchAll(VALOR_RE)].map((v) => toNumber(v[1]))
    if (valores.length !== 5) continue // linha não é uma linha de valores (ex: cabeçalho "UCO ...")
    portes[codigo] = valores[columnIndex]
  }
  return { portes, valorUco: COLUNAS_UCO[columnIndex] }
}
