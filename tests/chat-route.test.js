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

let ipCounter = 0
function getPostRequest(body) {
  ipCounter += 1
  const ip = `9.9.${Math.floor(ipCounter / 250)}.${ipCounter % 250}`
  return { json: async () => body, headers: { get: (name) => (name.toLowerCase() === 'x-forwarded-for' ? ip : null) } }
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

describe('Story 1.8 — AC5: pergunta ancorada por tópico', () => {
  it('topicoId válido troca para o system prompt de professor, com o material do tópico', async () => {
    const { POST } = await loadRoute()
    await POST(getPostRequest({
      query: 'por que esse número de auxiliares?',
      topicoId: 'quem-recebe',
      procedures: [procedimentoBase()],
    }))
    const systemMsg = capturedBody.messages.find((m) => m.role === 'system').content
    expect(systemMsg).toContain('professor do Glisse AI')
    expect(systemMsg).toContain('MATERIAL DA LIÇÃO — "Quem Mais Recebe"')
    // O texto do material vem só de aprendizado-content.js — checa uma
    // afirmação real desse tópico, com a fonte citada junto.
    expect(systemMsg).toContain('Sociedades Brasileiras de Especialidade')
    expect(systemMsg).toMatch(/Fonte:.*relatório seção 2\.4/)
  })

  it('regra de grounding restrito e de não inventar está no system prompt do modo lição', async () => {
    const { POST } = await loadRoute()
    await POST(getPostRequest({
      query: 'x',
      topicoId: 'porte',
      procedures: [procedimentoBase()],
    }))
    const systemMsg = capturedBody.messages.find((m) => m.role === 'system').content
    expect(systemMsg.toLowerCase()).toContain('somente com base no material da lição')
    expect(systemMsg.toLowerCase()).toContain('não está no material deste tópico')
  })

  it('topicoId inválido (fora da lista fixa) é rejeitado com 400, nunca vira prompt livre', async () => {
    const { POST } = await loadRoute()
    const res = await POST(getPostRequest({
      query: 'x',
      topicoId: 'topico-inventado-pelo-client',
      procedures: [procedimentoBase()],
    }))
    expect(res.status).toBe(400)
    expect(capturedBody).toBeNull() // nunca chegou a chamar a Groq
  })

  it('sem topicoId, mantém o system prompt normal de busca (comportamento não regride)', async () => {
    const { POST } = await loadRoute()
    await POST(getPostRequest({
      query: 'x',
      procedures: [procedimentoBase()],
    }))
    const systemMsg = capturedBody.messages.find((m) => m.role === 'system').content
    expect(systemMsg).toContain('assistente especializado em cobranças médicas')
    expect(systemMsg).not.toContain('professor do Glisse AI')
  })

  it('cada um dos 4 tópicos produz um system prompt válido com seu próprio título', async () => {
    const { POST } = await loadRoute()
    const { TOPICOS } = await import('../src/lib/aprendizado-content.js')
    for (const t of TOPICOS) {
      capturedBody = null
      await POST(getPostRequest({ query: 'x', topicoId: t.id, procedures: [procedimentoBase()] }))
      const systemMsg = capturedBody.messages.find((m) => m.role === 'system').content
      expect(systemMsg).toContain(`MATERIAL DA LIÇÃO — "${t.titulo}"`)
    }
  })
})

// 2026-08-18 — 'llama-3.1-8b-instant' parou de existir na API da Groq
// (model_not_found), derrubando o chat inteiro (achado do QA gate da Story
// 1.8). Travado em teste para que uma reversão futura não reintroduza um
// modelo morto sem ninguém notar até produção quebrar de novo.
describe('2026-08-18 — modelo da Groq e formatação de saída', () => {
  it('usa um modelo que existe (nunca o llama-3.1-8b-instant descontinuado)', async () => {
    const { POST } = await loadRoute()
    await POST(getPostRequest({ query: 'x', procedures: [procedimentoBase()] }))
    expect(capturedBody.model).toBe('openai/gpt-oss-20b')
    expect(capturedBody.model).not.toBe('llama-3.1-8b-instant')
  })

  it('instrui a não usar markdown, nos dois modos (a interface exibe texto puro)', async () => {
    const { POST } = await loadRoute()

    await POST(getPostRequest({ query: 'x', procedures: [procedimentoBase()] }))
    const systemMsgNormal = capturedBody.messages.find((m) => m.role === 'system').content
    expect(systemMsgNormal.toLowerCase()).toContain('não use formatação markdown')

    capturedBody = null
    await POST(getPostRequest({ query: 'x', topicoId: 'porte', procedures: [procedimentoBase()] }))
    const systemMsgLicao = capturedBody.messages.find((m) => m.role === 'system').content
    expect(systemMsgLicao.toLowerCase()).toContain('não use formatação markdown')
  })

  // 2026-08-18 — achado na verificação visual pós-troca de modelo: busca com
  // várias edições (ex: 7 procedimentos) voltava "Não foi possível processar
  // a resposta" (content vazio) ou texto cortado no meio. Causa: sem
  // reasoning_effort, o raciocínio interno do gpt-oss-20b consumia até 90% do
  // max_tokens antes de escrever a resposta visível. Confirmado via API real
  // que 'low' resolve (reasoning_tokens caiu de ~200 para ~10, finish_reason
  // passou a "stop"). Travado em teste para não regredir silenciosamente.
  it('pede reasoning_effort baixo à Groq (evita que o raciocínio interno consuma o orçamento de tokens da resposta)', async () => {
    const { POST } = await loadRoute()
    await POST(getPostRequest({ query: 'x', procedures: [procedimentoBase()] }))
    expect(capturedBody.reasoning_effort).toBe('low')
  })
})
