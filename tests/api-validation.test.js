import { describe, it, expect, beforeEach, vi } from 'vitest'

function jsonRequest(body, headers = {}) {
  return {
    headers: { get: (name) => headers[name.toLowerCase()] || null },
    json: async () => body,
  }
}

function getRequest(url, headers = {}) {
  return {
    url,
    headers: { get: (name) => headers[name.toLowerCase()] || null },
  }
}

describe('/api/chat — validação de input', () => {
  beforeEach(() => {
    vi.stubEnv('GROQ_API_KEY', 'test-key')
  })

  it('rejeita query vazia com 400', async () => {
    const { POST } = await import('../src/app/api/chat/route.js')
    const res = await POST(jsonRequest({ query: '', procedures: [{ procedimento: 'x' }] }, { 'x-forwarded-for': '1.1.1.1' }))
    expect(res.status).toBe(400)
  })

  it('rejeita query maior que 2000 caracteres com 400', async () => {
    const { POST } = await import('../src/app/api/chat/route.js')
    const res = await POST(jsonRequest({ query: 'a'.repeat(2001), procedures: [{ procedimento: 'x' }] }, { 'x-forwarded-for': '1.1.1.2' }))
    expect(res.status).toBe(400)
  })

  it('rejeita procedures vazio com 400', async () => {
    const { POST } = await import('../src/app/api/chat/route.js')
    const res = await POST(jsonRequest({ query: 'consulta', procedures: [] }, { 'x-forwarded-for': '1.1.1.3' }))
    expect(res.status).toBe(400)
  })

  it('rejeita mais de 20 procedures com 400', async () => {
    const { POST } = await import('../src/app/api/chat/route.js')
    const procedures = Array.from({ length: 21 }, () => ({ procedimento: 'x' }))
    const res = await POST(jsonRequest({ query: 'consulta', procedures }, { 'x-forwarded-for': '1.1.1.4' }))
    expect(res.status).toBe(400)
  })

  it('retorna 500 quando GROQ_API_KEY não está configurada', async () => {
    vi.stubEnv('GROQ_API_KEY', '')
    const { POST } = await import('../src/app/api/chat/route.js')
    const res = await POST(jsonRequest({ query: 'consulta', procedures: [{ procedimento: 'x' }] }, { 'x-forwarded-for': '1.1.1.5' }))
    expect(res.status).toBe(500)
  })
})

describe('/api/search — validação de input', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-key')
  })

  it('retorna lista vazia sem consultar o banco para query curta', async () => {
    const { GET } = await import('../src/app/api/search/route.js')
    const res = await GET(getRequest('http://localhost/api/search?q=a', { 'x-forwarded-for': '2.2.2.1' }))
    const data = await res.json()
    expect(data.results).toEqual([])
    expect(data.coveredChapters).toEqual(['1', '2', '3'])
  })

  it('retorna 500 quando variáveis do Supabase estão ausentes', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '')
    const { GET } = await import('../src/app/api/search/route.js')
    const res = await GET(getRequest('http://localhost/api/search?q=consulta', { 'x-forwarded-for': '2.2.2.2' }))
    expect(res.status).toBe(500)
  })
})
