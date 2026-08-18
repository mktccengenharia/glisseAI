// Story 1.7 — valor em R$ do porte anestésico na linha do chat (AC4).
// Não existia suíte para /api/chat antes desta story; criada aqui, focada só
// no que a AC4 pede (o resto da rota fica fora de escopo desta story).

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

let capturedBody = null

function mockGroqFetch() {
  return vi.fn(async (url, init) => {
    if (typeof url === 'string' && url.includes('groq.com')) {
      capturedBody = JSON.parse(init.body)
      return {
        ok: true,
        json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
      }
    }
    throw new Error(`fetch inesperado: ${url}`)
  })
}

function procedimentoBase(overrides = {}) {
  return {
    procedimento: 'Colecistectomia',
    codigo: '3.09.13.01-2',
    porte: '8B',
    valor_porte: 1500,
    numero_auxiliares: 0,
    porte_anestesico: null,
    valor_porte_anestesico: null,
    uco: 1.2,
    valor_uco: 24.56,
    versao: 'CBHPM 2018',
    ...overrides,
  }
}

async function loadRoute() {
  return import('../src/app/api/chat/route.js')
}

beforeEach(() => {
  capturedBody = null
  vi.stubEnv('GROQ_API_KEY', 'test-key')
  vi.stubGlobal('fetch', mockGroqFetch())
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

function getPostRequest(body) {
  return { json: async () => body, headers: { get: () => null } }
}

describe('Story 1.7 — AC4: valor do porte anestésico no contexto do chat', () => {
  it('inclui o valor em R$ e o rótulo "Valor do anestesista" quando presente', async () => {
    const { POST } = await loadRoute()
    await POST(getPostRequest({
      query: 'quanto ganha o anestesista?',
      procedures: [procedimentoBase({ porte_anestesico: 4, valor_porte_anestesico: 608 })],
    }))
    const systemMsg = capturedBody.messages.find((m) => m.role === 'system').content
    expect(systemMsg).toContain('Valor do anestesista: R$ 608,00')
    expect(systemMsg).toContain('Porte Anestésico: 4')
  })

  it('mostra "Não consta na fonte" quando o valor não existir na edição, nunca R$ 0,00', async () => {
    const { POST } = await loadRoute()
    await POST(getPostRequest({
      query: 'x',
      procedures: [procedimentoBase({ porte_anestesico: 4, valor_porte_anestesico: null })],
    }))
    const systemMsg = capturedBody.messages.find((m) => m.role === 'system').content
    expect(systemMsg).toContain('Valor do anestesista: Não consta na fonte')
    expect(systemMsg).not.toContain('R$ 0,00')
  })

  it('porte_anestesico 0 mantém "não participação", sem tentar mostrar valor', async () => {
    const { POST } = await loadRoute()
    await POST(getPostRequest({
      query: 'x',
      procedures: [procedimentoBase({ porte_anestesico: 0, valor_porte_anestesico: null })],
    }))
    const systemMsg = capturedBody.messages.find((m) => m.role === 'system').content
    // A própria linha de regra do system prompt contém "Valor do anestesista"
    // por definição — checar só a linha "Porte Anestésico:" do contexto do
    // procedimento, não a mensagem inteira.
    const linhaPorteAnestesico = systemMsg.split('\n').find((l) => l.trim().startsWith('Porte Anestésico:'))
    expect(linhaPorteAnestesico).toContain('não participação do anestesiologista')
    expect(linhaPorteAnestesico).not.toContain('Valor do anestesista')
  })

  it('porte_anestesico ausente mantém a mensagem de "não consta" já existente', async () => {
    const { POST } = await loadRoute()
    await POST(getPostRequest({
      query: 'x',
      procedures: [procedimentoBase({ porte_anestesico: null })],
    }))
    const systemMsg = capturedBody.messages.find((m) => m.role === 'system').content
    expect(systemMsg).toContain('Porte Anestésico: Não consta na fonte para este código')
  })

  it('system prompt proíbe explicitamente somar o valor do anestesista a outro total', async () => {
    const { POST } = await loadRoute()
    await POST(getPostRequest({
      query: 'x',
      procedures: [procedimentoBase()],
    }))
    const systemMsg = capturedBody.messages.find((m) => m.role === 'system').content
    expect(systemMsg.toLowerCase()).toContain('nunca some esse valor')
  })
})
