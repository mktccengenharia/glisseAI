import { describe, it, expect } from 'vitest'
import { parsePorteFile, parsePorteEmbedded, parsePorteMultiColuna } from '../scripts/cbhpm-import/lib/parse-porte.mjs'

describe('parsePorteFile', () => {
  it('extrai porte e valor no formato simples', () => {
    const raw = 'Tabela de portes\n1A R$ 224,90\n2B R$ 45,10\nUCO = R$ 11,50'
    const { portes, valorUco } = parsePorteFile(raw)
    expect(portes).toEqual({ '1A': 224.9, '2B': 45.1 })
    expect(valorUco).toBe(11.5)
  })

  it('retorna valorUco null quando não encontrado', () => {
    const { valorUco } = parsePorteFile('1A R$ 10,00')
    expect(valorUco).toBeNull()
  })
})

describe('parsePorteEmbedded', () => {
  it('extrai porte com prefixo PO (1-9)', () => {
    const raw = 'PO1A  R$ 8,00'
    const { portes } = parsePorteEmbedded(raw)
    expect(portes['1A']).toBe(8)
  })

  it('extrai porte com prefixo P (10-14)', () => {
    const raw = 'P10B  R$ 608,00'
    const { portes } = parsePorteEmbedded(raw)
    expect(portes['10B']).toBe(608)
  })

  it('extrai UCO a partir do texto de custo operacional', () => {
    const raw = 'Custo Operacional ... UCO = R$ 6,33'
    const { valorUco } = parsePorteEmbedded(raw)
    expect(valorUco).toBe(6.33)
  })
})

describe('parsePorteMultiColuna', () => {
  it('extrai a coluna correta por índice de vigência', () => {
    const raw = '1A 100,00 110,00 120,00 130,00 140,00'
    const { portes, valorUco } = parsePorteMultiColuna(raw, 2)
    expect(portes['1A']).toBe(120)
    expect(valorUco).toBe(14.33)
  })

  it('ignora linhas que não têm exatamente 5 valores', () => {
    const raw = 'UCO cabeçalho qualquer coisa\n1A 100,00 110,00 120,00 130,00 140,00'
    const { portes } = parsePorteMultiColuna(raw, 0)
    expect(Object.keys(portes)).toEqual(['1A'])
  })

  it('aceita valores com 1 casa decimal na última coluna', () => {
    const raw = '7B 500,00 510,00 520,00 530,00 627,2'
    const { portes } = parsePorteMultiColuna(raw, 4)
    expect(portes['7B']).toBe(627.2)
  })
})
