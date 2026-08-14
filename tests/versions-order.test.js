// Story 1.6, AC6 — as edições precisam sair em ordem cronológica real, não
// alfabética. O `.sort()` anterior punha "CBHPM 3ª edição" (2003, a mais
// antiga) DEPOIS de "CBHPM 2018", sugerindo ser a mais nova.

import { describe, it, expect } from 'vitest'
import { sortVersionsChronologically, EDITION_CHRONOLOGICAL_ORDER } from '../src/app/api/versions/route.js'

const TODAS = [
  'CBHPM 2010',
  'CBHPM 3ª edição',
  'CBHPM 2018',
  'CBHPM 2008',
  'CBHPM 2016',
  'CBHPM 2014',
  'CBHPM 2015',
]

describe('AC6 — ordenação cronológica das edições', () => {
  it('cobre as 7 edições importadas', () => {
    expect(Object.keys(EDITION_CHRONOLOGICAL_ORDER)).toHaveLength(7)
  })

  it('ordena da mais antiga para a mais nova', () => {
    expect(sortVersionsChronologically(TODAS)).toEqual([
      'CBHPM 3ª edição',
      'CBHPM 2008',
      'CBHPM 2010',
      'CBHPM 2014',
      'CBHPM 2015',
      'CBHPM 2016',
      'CBHPM 2018',
    ])
  })

  // O par que o `.sort()` alfabético invertia.
  it('coloca "CBHPM 3ª edição" antes de "CBHPM 2018"', () => {
    const ordenado = sortVersionsChronologically(['CBHPM 2018', 'CBHPM 3ª edição'])
    expect(ordenado).toEqual(['CBHPM 3ª edição', 'CBHPM 2018'])
    // Prova de que o defeito era real: alfabeticamente sai o contrário.
    expect([...ordenado].sort()).toEqual(['CBHPM 2018', 'CBHPM 3ª edição'])
  })

  it('não muta o array recebido', () => {
    const entrada = ['CBHPM 2018', 'CBHPM 3ª edição']
    sortVersionsChronologically(entrada)
    expect(entrada).toEqual(['CBHPM 2018', 'CBHPM 3ª edição'])
  })

  it('joga edição desconhecida para o fim em vez de descartá-la', () => {
    const ordenado = sortVersionsChronologically(['CBHPM 2023', 'CBHPM 2018', 'CBHPM 3ª edição'])
    expect(ordenado).toEqual(['CBHPM 3ª edição', 'CBHPM 2018', 'CBHPM 2023'])
  })

  it('tolera entrada vazia ou nula', () => {
    expect(sortVersionsChronologically([])).toEqual([])
    expect(sortVersionsChronologically(null)).toEqual([])
  })
})
