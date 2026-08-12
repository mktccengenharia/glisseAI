/** @type {import('next').NextConfig} */
const nextConfig = {
  // Permite importações de módulos dentro de src

  // @huggingface/transformers usa onnxruntime-node (binário nativo) para
  // rodar o modelo de embeddings localmente na função serverless — não deve
  // ser processado pelo bundler do Next, só carregado em runtime Node.js.
  experimental: {
    serverComponentsExternalPackages: ['@huggingface/transformers', 'onnxruntime-node'],
  },
}

module.exports = nextConfig
