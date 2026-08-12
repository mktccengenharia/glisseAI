import { describe, it, expect } from 'vitest'
import { normalizeCodigoSearchTerm } from '../src/app/api/search/route.js'

describe('normalizeCodigoSearchTerm', () => {
  it('reconstrói a pontuação de um código com exatamente 8 dígitos', () => {
    expect(normalizeCodigoSearchTerm('30913012')).toBe('3.09.13.01-2')
  })

  it('reconstrói corretamente outro código de 8 dígitos', () => {
    expect(normalizeCodigoSearchTerm('40101010')).toBe('4.01.01.01-0')
  })

  it('não altera termos que já têm pontuação', () => {
    expect(normalizeCodigoSearchTerm('3.09.13.01-2')).toBe('3.09.13.01-2')
  })

  it('não altera buscas numéricas parciais (menos de 8 dígitos)', () => {
    expect(normalizeCodigoSearchTerm('12')).toBe('12')
    expect(normalizeCodigoSearchTerm('309130')).toBe('309130')
  })

  it('não altera sequências numéricas maiores que 8 dígitos', () => {
    expect(normalizeCodigoSearchTerm('123456789')).toBe('123456789')
  })
})
