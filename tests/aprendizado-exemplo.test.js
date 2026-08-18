// Story 1.8 — AC4: cálculo do exemplo ao vivo por tópico. Replica a lógica de
// cálculo de ExemploAoVivo (src/app/aprender/page.jsx) — mesmo padrão de
// tests/procedure-display.test.js (suíte roda em `node`, sem DOM, então a
// lógica de decisão é testada isolada da JSX). As funções de formatação
// (formatValorBRL, valorAuxiliar) já são testadas em procedure-display.test.js;
// aqui só o que é específico deste componente.

import { describe, it, expect } from 'vitest'
import { isAusente, DEFAULT_AUX_PCT, valorAuxiliar } from '../src/lib/procedure-display.js'

// Réplica do cálculo ilustrativo do Bloco 3 (modificadores) — nunca afirma
// que o procedimento do exemplo foi urgente de verdade, só demonstra a
// fórmula (mesmo espírito do "Exemplo de cálculo, não norma" do relatório).
function calcularComUrgencia(valorPorte) {
  return isAusente(valorPorte) ? null : valorPorte * 1.3
}

// Réplica da lista de auxiliares do Bloco 4.
function calcularAuxiliares(valorPorte, numeroAuxiliares, auxPct) {
  const pct = Array.isArray(auxPct) && auxPct.length ? auxPct : DEFAULT_AUX_PCT
  return Array.from({ length: numeroAuxiliares }, (_, j) => valorAuxiliar(valorPorte, pct[j]))
}

describe('AC4 — Bloco 3 (modificadores): acréscimo de urgência é ilustrativo, +30% sobre o porte', () => {
  it('calcula 30% a mais sobre um valor de porte real', () => {
    expect(calcularComUrgencia(1000)).toBe(1300)
  })

  it('valor_porte ausente não inventa um cálculo (não vira 0 nem NaN)', () => {
    expect(calcularComUrgencia(null)).toBeNull()
    expect(calcularComUrgencia(undefined)).toBeNull()
  })
})

describe('AC4 — Bloco 4 (quem recebe): rateio de auxiliares reaproveita valorAuxiliar', () => {
  it('calcula cada auxiliar como percentual do PORTE, edição 2018 (60/40/30/30)', () => {
    const valores = calcularAuxiliares(2122.89, 3, [0.6, 0.4, 0.3, 0.3])
    expect(valores).toHaveLength(3)
    expect(valores[0]).toBeCloseTo(2122.89 * 0.6)
    expect(valores[1]).toBeCloseTo(2122.89 * 0.4)
    expect(valores[2]).toBeCloseTo(2122.89 * 0.3)
  })

  it('usa DEFAULT_AUX_PCT (30/20/20/20) quando o registro não tem aux_pct', () => {
    const valores = calcularAuxiliares(1000, 2, null)
    expect(valores[0]).toBe(300)
    expect(valores[1]).toBe(200)
  })

  it('valor_porte ausente propaga null por auxiliar, nunca 0 (não inventa)', () => {
    const valores = calcularAuxiliares(null, 2, [0.6, 0.4, 0.3, 0.3])
    expect(valores).toEqual([null, null])
  })

  it('zero auxiliares produz lista vazia, não um item com valor 0', () => {
    expect(calcularAuxiliares(1000, 0, [0.6, 0.4, 0.3, 0.3])).toEqual([])
  })
})

describe('AC4 — Bloco 4: porte anestésico degrada com graça sem a Story 1.7', () => {
  // ExemploAoVivo só mostra o valor em R$ do porte anestésico quando
  // valor_porte_anestesico é um número — nunca inventa um valor quando o
  // campo está ausente (ex.: Story 1.7 não mesclada, ou edição sem valor
  // cadastrado para o porte equivalente).
  function temValorPorteAnestesico(exemplo) {
    return typeof exemplo.valor_porte_anestesico === 'number'
  }

  it('mostra o valor quando valor_porte_anestesico é número', () => {
    expect(temValorPorteAnestesico({ porte_anestesico: 6, valor_porte_anestesico: 1200 })).toBe(true)
  })

  it('não tenta mostrar valor quando o campo está ausente (Story 1.7 não disponível)', () => {
    expect(temValorPorteAnestesico({ porte_anestesico: 6 })).toBe(false)
    expect(temValorPorteAnestesico({ porte_anestesico: 6, valor_porte_anestesico: null })).toBe(false)
  })
})
