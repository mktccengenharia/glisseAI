// Embeddings open source, rodando localmente na função serverless via
// @huggingface/transformers (ONNX) — sem API externa, sem custo por chamada,
// sem chave. Ver docs/opportunity-mapping.md (busca semântica).
//
// Modelo: Xenova/multilingual-e5-small (384 dimensões, multilíngue, cobre
// português). Convenção do modelo e5: prefixar "query: " em textos de busca
// e "passage: " em textos indexados — isso muda a qualidade da similaridade,
// não é só estética.

import { pipeline } from '@huggingface/transformers'

const MODEL_ID = 'Xenova/multilingual-e5-small'

// Singleton: o modelo (~120MB quantizado) só deve ser carregado uma vez por
// instância da função (Fluid Compute reaproveita instâncias entre
// requisições). Carregar isso no topo do módulo, fora do handler, faria o
// import falhar/travar o cold start de QUALQUER rota que importe este
// arquivo — por isso o carregamento é preguiçoso, disparado só no primeiro uso.
let extractorPromise = null

function getExtractor() {
  if (!extractorPromise) {
    extractorPromise = pipeline('feature-extraction', MODEL_ID, { dtype: 'q8' })
  }
  return extractorPromise
}

async function embed(text, prefix) {
  const extractor = await getExtractor()
  const output = await extractor(`${prefix}${text}`, { pooling: 'mean', normalize: true })
  return Array.from(output.data)
}

export function embedQuery(text) {
  return embed(text, 'query: ')
}

export function embedPassage(text) {
  return embed(text, 'passage: ')
}
