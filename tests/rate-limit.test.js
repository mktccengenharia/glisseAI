import { describe, it, expect, vi } from 'vitest'
import { rateLimit } from '../src/lib/rate-limit.js'

function mockRequest(ip) {
  return {
    headers: {
      get: (name) => (name === 'x-forwarded-for' ? ip : null),
    },
  }
}

describe('rateLimit', () => {
  it('permite requisições dentro do limite', () => {
    const req = mockRequest('1.2.3.4')
    for (let i = 0; i < 3; i++) {
      const result = rateLimit(req, { scope: 'test-a', limit: 3, windowMs: 60_000 })
      expect(result.allowed).toBe(true)
    }
  })

  it('bloqueia após exceder o limite na mesma janela', () => {
    const req = mockRequest('5.6.7.8')
    for (let i = 0; i < 3; i++) {
      rateLimit(req, { scope: 'test-b', limit: 3, windowMs: 60_000 })
    }
    const result = rateLimit(req, { scope: 'test-b', limit: 3, windowMs: 60_000 })
    expect(result.allowed).toBe(false)
    expect(result.retryAfterSeconds).toBeGreaterThan(0)
  })

  it('trata IPs diferentes como buckets independentes', () => {
    const reqA = mockRequest('9.9.9.9')
    const reqB = mockRequest('10.10.10.10')
    for (let i = 0; i < 3; i++) {
      rateLimit(reqA, { scope: 'test-c', limit: 3, windowMs: 60_000 })
    }
    const blocked = rateLimit(reqA, { scope: 'test-c', limit: 3, windowMs: 60_000 })
    const allowed = rateLimit(reqB, { scope: 'test-c', limit: 3, windowMs: 60_000 })
    expect(blocked.allowed).toBe(false)
    expect(allowed.allowed).toBe(true)
  })

  it('libera novamente após a janela expirar', () => {
    vi.useFakeTimers()
    const req = mockRequest('11.11.11.11')
    rateLimit(req, { scope: 'test-d', limit: 1, windowMs: 1000 })
    const blocked = rateLimit(req, { scope: 'test-d', limit: 1, windowMs: 1000 })
    expect(blocked.allowed).toBe(false)

    vi.advanceTimersByTime(1001)
    const allowedAgain = rateLimit(req, { scope: 'test-d', limit: 1, windowMs: 1000 })
    expect(allowedAgain.allowed).toBe(true)
    vi.useRealTimers()
  })

  it('usa "unknown" como chave quando não há header de IP', () => {
    const req = { headers: { get: () => null } }
    const result = rateLimit(req, { scope: 'test-e', limit: 1, windowMs: 60_000 })
    expect(result.allowed).toBe(true)
  })
})
