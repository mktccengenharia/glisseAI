---
name: fontes-cbhpm-oficiais
description: Onde estão os PDFs oficiais das 7 edições da CBHPM e como lê-los (pdftotext), para não pesquisar em blog o que está na fonte primária
metadata:
  type: reference
---

Os PDFs oficiais da CBHPM já estão no ambiente, fora do repositório:
`C:\Users\carme\OneDrive\Documentos\JOHN\tabelas_cbhpm\tabelas_cbhpm\`

Contém as 7 edições que o app cobre (3ª, 2008, 2010, 2014, 2015, 2016, 2018), os Comunicados
Oficiais da AMB com valores de porte e UCO (`PORTE CBHPM 2018.pdf` = UCO R$ 20,47;
`Porte CBHPM 2020-2021.pdf` = UCO R$ 21,89) e um `tabela-tuss x cbhpm.pdf`.

Leitura: `pdftotext -layout -enc UTF-8 <arquivo> <saida>.txt` (poppler disponível em
`/mingw64/bin/pdftotext`). É a mesma ferramenta usada por `scripts/cbhpm-import/01-extract-text.mjs`.
O warning `Unknown filter 'Crypt'` é inofensivo, o texto sai correto.

As **Instruções Gerais** (porte, UCO, urgência/emergência, via de acesso, auxiliares, internação)
ficam nas primeiras ~30 páginas. As **Instruções Gerais Específicas para a Anestesiologia** ficam
no Capítulo 3, no bloco de observações do código `3.16.02.99-1`.

**Why:** quase toda regra de faturamento que aparece em blog está no texto oficial, e os blogs
erram. Num caso concreto (correspondência de porte anestésico) o blog contradizia as 8 edições
oficiais. Ler o PDF é mais rápido e mais confiável que buscar na web.

**How to apply:** antes de citar terceiro sobre regra de CBHPM, procurar no texto extraído.
Só usar web para o que a tabela não cobre: contrato de operadora, TISS/TUSS/ANS, glosa.
Ver [[glisse-precisao-financeira]] e `docs/research/2026-08-17-fundamentos-faturamento-cbhpm/`.
