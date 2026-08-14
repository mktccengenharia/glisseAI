import { defineConfig } from 'vitest/config'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    // Importar /api/search puxa src/lib/embeddings.js, que carrega o módulo
    // @huggingface/transformers. Sozinho leva ~150ms, mas com vários arquivos
    // de teste em paralelo passa dos 5s padrão do vitest e o teste estoura por
    // tempo de import, não por lentidão do código sob teste.
    testTimeout: 30_000,
  },
})
