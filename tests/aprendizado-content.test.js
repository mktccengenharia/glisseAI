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

  // 2026-08-18: o parágrafo de esclarecimento terminológico sobre "horário
  // especial" foi removido do conteúdo a pedido do usuário (deixar a lição
  // mais direta) — a regra em si (acréscimo de 30% em plantão/urgência)
  // continua no primeiro parágrafo de "Modificadores", só sem a introdução
  // sobre o nome popular vs. o nome oficial da CBHPM.

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

  // 2026-08-18: o parágrafo com os percentuais das edições 2018/2022 (60/40/
  // 30/30) foi removido do texto a pedido do usuário — esse dado continua
  // visível para quem estuda, só que via "Exemplo ao vivo" (o exemplo padrão
  // é CBHPM 2018, que usa exatamente esses percentuais), não como prosa
  // duplicada. Fica só a citação textual da faixa mais antiga (3ª a 2016).
  it('percentual de auxiliar citado no texto está associado à edição correspondente', () => {
    const blocoAuxiliares = TOPICOS.find((t) => t.id === 'quem-recebe').paragrafos
    const percentuais = blocoAuxiliares.filter((p) => /30%|60%/.test(p.texto))
    expect(percentuais.length).toBeGreaterThanOrEqual(1)
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
