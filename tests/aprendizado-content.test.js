// Story 1.8 — AC2/AC3: conteúdo dos 4 blocos do modo de aprendizado, com
// restrições obrigatórias do Artigo IV (No Invention). Testa o CONTEÚDO
// (src/lib/aprendizado-content.js), não a renderização — mesmo princípio de
// tests/procedure-display.test.js (suíte roda em ambiente `node`, sem DOM).

import { describe, it, expect } from 'vitest'
import { TOPICOS, CODIGO_EXEMPLO, VERSAO_EXEMPLO } from '../src/lib/aprendizado-content.js'

describe('AC2 — estrutura dos 4 blocos', () => {
  it('existem exatamente os 4 tópicos aprovados, na ordem do opportunity-mapping', () => {
    expect(TOPICOS.map((t) => t.id)).toEqual(['porte', 'quatro-numeros', 'modificadores', 'quem-recebe'])
  })

  it('todo tópico tem título e pelo menos um parágrafo com fonte', () => {
    for (const t of TOPICOS) {
      expect(t.titulo).toBeTruthy()
      expect(t.paragrafos.length).toBeGreaterThan(0)
      for (const p of t.paragrafos) {
        expect(p.texto).toBeTruthy()
        expect(p.fonte).toBeTruthy()
      }
    }
  })

  it('exemplo ao vivo aponta para um código e edição reais definidos (não vazio)', () => {
    expect(CODIGO_EXEMPLO).toMatch(/^\d\.\d{2}\.\d{2}\.\d{2}-\d$/)
    expect(VERSAO_EXEMPLO).toMatch(/^CBHPM /)
  })
})

describe('AC3 — restrições de conteúdo (Artigo IV)', () => {
  const textoCompleto = TOPICOS.flatMap((t) => t.paragrafos.map((p) => p.texto)).join('\n')

  it('nunca usa "horário especial" como se fosse termo da CBHPM (só para dizer que NÃO é)', () => {
    const ocorrencias = textoCompleto.match(/horário especial/gi) || []
    // Pode mencionar o termo (para explicar que não é da CBHPM), mas cada
    // menção tem que vir acompanhada da negação/explicação, nunca sozinha.
    for (const trecho of TOPICOS.flatMap((t) => t.paragrafos)) {
      if (/horário especial/i.test(trecho.texto)) {
        expect(trecho.texto).toMatch(/não é|NÃO existe|não aparece/i)
      }
    }
    expect(ocorrencias.length).toBeGreaterThan(0) // o tópico precisa mencionar o termo popular
  })

  it('nome oficial "Atendimento de Urgência e Emergência" está presente', () => {
    expect(textoCompleto).toContain('Atendimento de Urgência e Emergência')
  })

  it('nunca afirma "por que" um procedimento paga auxiliar além do que a fonte diz', () => {
    // A única resposta permitida é a atribuição normativa — não pode haver
    // linguagem de justificativa clínica ("porque é mais complexo",
    // "porque exige...", etc.) associada a auxiliares.
    const blocoAuxiliares = TOPICOS.find((t) => t.id === 'quem-recebe').paragrafos
      .map((p) => p.texto).join(' ')
    expect(blocoAuxiliares).toMatch(/não publica nenhum critério geral/i)
    expect(blocoAuxiliares).not.toMatch(/porque (é|exige|precisa|requer)/i)
  })

  it('nunca apresenta soma de porte + UCO + porte anestésico como "valor total do procedimento"', () => {
    expect(textoCompleto).not.toMatch(/valor total do procedimento[^"]*(é|=|soma)/i)
    // A única menção a "valor total do procedimento" deve ser para negar que ela exista.
    const mencoes = TOPICOS.flatMap((t) => t.paragrafos).filter((p) => /valor total do procedimento/i.test(p.texto))
    for (const p of mencoes) {
      expect(p.texto).toMatch(/nunca|não existe/i)
    }
  })

  it('percentuais de auxiliar citam a edição a que se aplicam, nunca genérico', () => {
    const blocoAuxiliares = TOPICOS.find((t) => t.id === 'quem-recebe').paragrafos
    const percentuais = blocoAuxiliares.filter((p) => /30%|60%/.test(p.texto))
    expect(percentuais.length).toBeGreaterThanOrEqual(2) // pelo menos um por faixa de edição
    for (const p of percentuais) {
      expect(p.texto + p.fonte).toMatch(/edições?|edição/i)
    }
  })

  it('toda regra de número de item cita a fonte, nunca um número solto sem referência', () => {
    for (const t of TOPICOS) {
      for (const p of t.paragrafos) {
        const temNumeroDeItem = /\bitem \d/i.test(p.texto)
        if (temNumeroDeItem) {
          expect(p.fonte).toBeTruthy()
        }
      }
    }
  })
})
