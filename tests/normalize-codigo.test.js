import { describe, it, expect } from 'vitest'
import { normalizeCodigoSearchTerm } from '../src/app/api/search/route.js'

describe('normalizeCodigoSearchTerm', () => {
  it('reconstrói a pontuação de um código com exatamente 8 dígitos', () => {
    expect(normalizeCodigoSearchTerm('30913012')).toBe('3.09.13.01-2')
  })

  it('reconstrói corretamente outro código de 8 dígitos', () => {
    expect(normalizeCodigoSearchTerm('40101010')).toBe('4.01.01.01-0')
  })

  it('não altera termos que já têm pontuação correta', () => {
    expect(normalizeCodigoSearchTerm('3.09.13.01-2')).toBe('3.09.13.01-2')
  })

  it('corrige separador errado (hífen em vez de ponto) num código completo', () => {
    expect(normalizeCodigoSearchTerm('3-09-13-01-2')).toBe('3.09.13.01-2')
  })

  it('corrige espaços em vez de pontuação num código completo', () => {
    expect(normalizeCodigoSearchTerm('3 09 13 01 2')).toBe('3.09.13.01-2')
  })

  it('reconstrói um código parcial que já tem algum separador', () => {
    expect(normalizeCodigoSearchTerm('3-09-13')).toBe('3.09.13')
    expect(normalizeCodigoSearchTerm('3.09.13')).toBe('3.09.13')
  })

  it('não altera buscas numéricas curtas sem nenhuma pontuação (sem sinal de ser um código)', () => {
    expect(normalizeCodigoSearchTerm('12')).toBe('12')
    expect(normalizeCodigoSearchTerm('309130')).toBe('309130')
  })

  it('não altera sequências numéricas maiores que 8 dígitos', () => {
    expect(normalizeCodigoSearchTerm('123456789')).toBe('123456789')
  })
})
