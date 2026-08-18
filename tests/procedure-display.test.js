// Story 1.6 — fidelidade do dado exibido.
// A suíte roda em ambiente `node` (vitest.config.mjs), sem DOM: por isso a
// lógica de decisão do ProcedureCard vive em src/lib/procedure-display.js e é
// testada aqui diretamente, sem renderizar React.

import { describe, it, expect } from 'vitest'
import {
  NAO_CONSTA,
  isAusente,
  isAusenteTexto,
  formatValorBRL,
  formatNumero,
  formatUnidadeRadiofarmaco,
  camposCapitulo4Presentes,
  resumoResultados,
  isResultadoAproximado,
  MAX_CARDS_EXIBIDOS,
  MATCH_SEMANTICO,
  DEFAULT_AUX_PCT,
  valorAuxiliar,
} from '../src/lib/procedure-display.js'

// Story 1.8: extraído de ProcedureCard (page.jsx) para reaproveitar no
// exemplo ao vivo do modo de aprendizado, sem duplicar a fórmula.
describe('valorAuxiliar / DEFAULT_AUX_PCT (extraído para a Story 1.8)', () => {
  it('percentual sobre o PORTE, nunca porte + custo operacional', () => {
    expect(valorAuxiliar(1000, 0.3)).toBe(300)
  })

  it('valor_porte ausente não vira 0 (null * pct)', () => {
    expect(valorAuxiliar(null, 0.3)).toBeNull()
    expect(valorAuxiliar(undefined, 0.3)).toBeNull()
  })

  it('DEFAULT_AUX_PCT é o percentual pré-2018 (30/20/20/20)', () => {
    expect(DEFAULT_AUX_PCT).toEqual([0.3, 0.2, 0.2, 0.2])
  })
})

describe('AC1 — null (não consta na fonte) nunca vira zero', () => {
  it('trata null e undefined como ausentes, mas 0 como dado presente', () => {
    expect(isAusente(null)).toBe(true)
    expect(isAusente(undefined)).toBe(true)
    expect(isAusente(0)).toBe(false)
  })

  it('valor_porte null exibe "Não consta na fonte", não R$ 0,00', () => {
    expect(formatValorBRL(null)).toBe(NAO_CONSTA)
    expect(formatValorBRL(undefined)).toBe(NAO_CONSTA)
  })

  it('valor_porte 0 continua exibindo R$ 0,00', () => {
    expect(formatValorBRL(0)).toMatch(/^R\$\s?0,00$/)
  })

  it('valor_porte com valor real é formatado em BRL', () => {
    expect(formatValorBRL(1234.5)).toMatch(/^R\$\s?1\.234,50$/)
  })

  // Bug reportado em produção: "Intra-operatório" mostrava 0 onde a fonte não
  // traz UCO. `valor_uco`/`uco` null vinham de `|| 0` e `|| '-'`.
  it('valor_uco null exibe "Não consta na fonte", não R$ 0,00', () => {
    expect(formatValorBRL(null)).toBe(NAO_CONSTA)
  })

  it('valor_uco 0 continua exibindo R$ 0,00', () => {
    expect(formatValorBRL(0)).toMatch(/^R\$\s?0,00$/)
  })

  it('uco null exibe "Não consta na fonte", não "-"', () => {
    expect(formatNumero(null)).toBe(NAO_CONSTA)
  })

  it('uco igual a 0 é exibido como 0 (antes era escondido por `uco || "-"`)', () => {
    expect(formatNumero(0)).toBe('0')
  })

  it('uco numérico é reproduzido literalmente, sem arredondar', () => {
    expect(formatNumero(0.6875)).toBe('0.6875')
  })
})

// Regressão do bug relatado em produção pelo usuário-piloto (2026-08-13):
// "quando pesquiso Intra-operatório, aparecia o valor do porte, sem uco, e
// agora quando pesquiso aparece 0". Replica a derivação de campos que o
// ProcedureCard faz, para travar o comportamento.
describe('AC1 — regressão "Intra-operatório" (valor_uco null exibia 0)', () => {
  function derivarCard(item) {
    const uco = item.uco ?? null
    const valorUco = item.valorUcoR$ ?? item.valor_uco ?? null
    const valorPorte = item.valorPorteR$ ?? item.valor_porte ?? null
    return {
      porte: `${item.porte} · ${isAusente(valorPorte) ? NAO_CONSTA : formatValorBRL(valorPorte)}`,
      uco:
        isAusente(uco) && isAusente(valorUco)
          ? NAO_CONSTA
          : `${formatNumero(uco)} · ${formatValorBRL(valorUco)}`,
    }
  }

  it('procedimento sem UCO na fonte mostra "Não consta na fonte", nunca 0 nem R$ 0,00', () => {
    const card = derivarCard({
      procedimento: 'Intra-operatório',
      porte: '3C',
      valor_porte: 320.45,
      uco: null,
      valor_uco: null,
    })
    expect(card.uco).toBe(NAO_CONSTA)
    expect(card.uco).not.toContain('0,00')
    expect(card.uco).not.toBe('0')
    // O valor do porte, que a fonte traz, continua aparecendo normalmente.
    expect(card.porte).toMatch(/^3C · R\$\s?320,45$/)
  })

  it('procedimento com UCO genuinamente zero continua mostrando 0 · R$ 0,00', () => {
    const card = derivarCard({ porte: '1A', valor_porte: 0, uco: 0, valor_uco: 0 })
    expect(card.uco).toMatch(/^0 · R\$\s?0,00$/)
    expect(card.porte).toMatch(/^1A · R\$\s?0,00$/)
  })

  it('exibe o UCO mesmo quando só o valor em R$ falta (e vice-versa)', () => {
    expect(derivarCard({ porte: '2A', valor_porte: 10, uco: 1.5, valor_uco: null }).uco)
      .toBe(`1.5 · ${NAO_CONSTA}`)
    expect(derivarCard({ porte: '2A', valor_porte: 10, uco: null, valor_uco: 18.3 }).uco)
      .toMatch(new RegExp(`^${NAO_CONSTA} · R\\$\\s?18,30$`))
  })

  it('valor_porte ausente não vira R$ 0,00 no porte', () => {
    const card = derivarCard({ porte: '4B', valor_porte: null, uco: 1, valor_uco: 12 })
    expect(card.porte).toBe(`4B · ${NAO_CONSTA}`)
  })
})

// Story 1.7 — valor em R$ do porte anestésico. Replica a lógica de
// ProcedureCard (src/app/page.jsx) para o bloco "Porte Anestésico", mesmo
// padrão de derivarCard acima (débito conhecido — TEST-001 da Story 1.6).
describe('Story 1.7 — valor em R$ do porte anestésico', () => {
  function derivarPorteAnestesico(item) {
    const porteAnestesico = item.porte_anestesico ?? null
    const valorPorteAnestesico = item.valor_porte_anestesico ?? null
    const anestesia = item.anestesia || '0'
    if (porteAnestesico !== null && porteAnestesico !== 0) {
      return {
        texto: `${porteAnestesico} · ${isAusente(valorPorteAnestesico) ? NAO_CONSTA : formatValorBRL(valorPorteAnestesico)}`,
        rotulo: 'Valor do anestesista',
      }
    }
    return {
      texto: porteAnestesico !== null ? String(porteAnestesico) : (anestesia !== '0' ? anestesia : 'Sem anestesia'),
      rotulo: null,
    }
  }

  it('AC3: porte_anestesico com valor cadastrado exibe código · R$ e rotula "Valor do anestesista"', () => {
    const card = derivarPorteAnestesico({ porte_anestesico: 4, valor_porte_anestesico: 608 })
    expect(card.texto).toMatch(/^4 · R\$\s?608,00$/)
    expect(card.rotulo).toBe('Valor do anestesista')
  })

  it('AC3: porte_anestesico sem valor cadastrado na edição exibe "Não consta na fonte", nunca R$ 0,00', () => {
    const card = derivarPorteAnestesico({ porte_anestesico: 4, valor_porte_anestesico: null })
    expect(card.texto).toBe(`4 · ${NAO_CONSTA}`)
    expect(card.texto).not.toContain('0,00')
  })

  // Comportamento PRESERVADO de propósito (AC3: "mantém o comportamento atual
  // para porte_anestesico === 0"): o ternário original de page.jsx só cai no
  // texto de `anestesia` quando porteAnestesico é null — para 0 (código válido,
  // "não participação do anestesiologista"), sempre mostrou o código bruto "0",
  // nunca "Sem anestesia". A Story 1.7 não muda esse comportamento, só evita
  // tentar buscar/mostrar um valor em R$ para ele.
  it('AC3: porte_anestesico 0 mantém o código bruto "0" (comportamento pré-existente), sem valor em R$', () => {
    const card = derivarPorteAnestesico({ porte_anestesico: 0, valor_porte_anestesico: null, anestesia: '0' })
    expect(card.texto).toBe('0')
    expect(card.rotulo).toBeNull()
  })

  it('AC3: porte_anestesico ausente cai no texto de anestesia existente (sem regredir)', () => {
    expect(derivarPorteAnestesico({ porte_anestesico: null, anestesia: '0' }).texto).toBe('Sem anestesia')
    expect(derivarPorteAnestesico({ porte_anestesico: null, anestesia: 'Geral' }).texto).toBe('Geral')
  })

  // Regressão de UX-001 (Story 1.6): dois campos que pareciam a mesma coisa
  // já geraram confusão real no card. O valor do anestesista nunca deve
  // incorporar nem se confundir com o valor do porte do cirurgião.
  it('AC3: valor do anestesista nunca soma nem se confunde com valor_porte do cirurgião', () => {
    const card = derivarPorteAnestesico({
      porte_anestesico: 4,
      valor_porte_anestesico: 608,
      // valor_porte (cirurgião) é um número bem diferente — se a lógica
      // somasse ou vazasse esse valor, o teste abaixo pegaria.
      valor_porte: 1500,
    })
    expect(card.texto).toMatch(/^4 · R\$\s?608,00$/)
    expect(card.texto).not.toContain('1500')
    expect(card.texto).not.toContain('2108') // 608 + 1500, se alguém somar por engano
  })
})

describe('AC2 — campos do Capítulo 4', () => {
  const itemRadiologia = {
    custo_operacional: 1.2,
    custo_filme_doc: 0.5,
    numero_incidencias: 3,
    unidade_radiofarmaco: '*',
  }

  it('exibe os três campos quando a fonte os traz (custo_operacional fica de fora: mesmo valor do UCO já mostrado acima, gate UX-001)', () => {
    const campos = camposCapitulo4Presentes(itemRadiologia)
    expect(campos.map((c) => c.key)).toEqual([
      'custo_filme_doc',
      'numero_incidencias',
      'unidade_radiofarmaco',
    ])
  })

  // Política de null DIFERENTE da do AC1, de propósito: esses campos só se
  // aplicam a Radiologia/Medicina Nuclear.
  it('omite (não exibe "Não consta") os campos ausentes', () => {
    const campos = camposCapitulo4Presentes({
      custo_operacional: null,
      custo_filme_doc: undefined,
      numero_incidencias: null,
      unidade_radiofarmaco: null,
    })
    expect(campos).toEqual([])
  })

  it('omite unidade_radiofarmaco quando vem string vazia', () => {
    const campos = camposCapitulo4Presentes({ unidade_radiofarmaco: '   ' })
    expect(campos).toEqual([])
    expect(isAusenteTexto('   ')).toBe(true)
  })

  it('mantém campo com valor 0 (dado presente e igual a zero)', () => {
    const campos = camposCapitulo4Presentes({ numero_incidencias: 0 })
    expect(campos).toHaveLength(1)
    expect(campos[0].value).toBe('0')
  })

  // Article IV — No Invention.
  it('unidade_radiofarmaco "*" chega ao card sem transformação', () => {
    expect(formatUnidadeRadiofarmaco('*')).toBe('*')
    const campos = camposCapitulo4Presentes(itemRadiologia)
    const ur = campos.find((c) => c.key === 'unidade_radiofarmaco')
    expect(ur.value).toBe('*')
    expect(ur.legenda).toContain('Colégio Brasileiro de Radiologia')
  })

  it('não formata custo_filme_doc como moeda', () => {
    const campos = camposCapitulo4Presentes(itemRadiologia)
    for (const campo of campos) {
      expect(campo.value).not.toContain('R$')
    }
  })

  it('tolera item nulo/vazio', () => {
    expect(camposCapitulo4Presentes(null)).toEqual([])
    expect(camposCapitulo4Presentes({})).toEqual([])
  })
})

describe('AC3 — contagem de resultados sem afirmar exaustividade', () => {
  it('renderiza até 10 cards, não 5', () => {
    expect(MAX_CARDS_EXIBIDOS).toBe(10)
  })

  it('mostra a contagem exata abaixo do teto', () => {
    expect(resumoResultados(1)).toBe('1 resultado encontrado.')
    expect(resumoResultados(7)).toBe('7 resultados encontrados.')
  })

  it('no teto de 10, avisa do limite e NÃO afirma que a lista é exaustiva', () => {
    const msg = resumoResultados(10)
    expect(msg).toContain('10 resultados')
    expect(msg).toContain('máximo')
    expect(msg).toContain('Pode haver outros')
    expect(msg).not.toMatch(/todos os resultados|lista completa/i)
  })

  it('não gera mensagem quando não há resultado', () => {
    expect(resumoResultados(0)).toBeNull()
    expect(resumoResultados(undefined)).toBeNull()
  })
})

describe('AC4 — rótulo de resultado aproximado', () => {
  it('rotula apenas o que veio do ramo semântico', () => {
    expect(isResultadoAproximado(MATCH_SEMANTICO)).toBe(true)
  })

  it('não rotula código exato, full-text nem busca sem acento', () => {
    expect(isResultadoAproximado('codigo')).toBe(false)
    expect(isResultadoAproximado('texto')).toBe(false)
    expect(isResultadoAproximado('texto-sem-acento')).toBe(false)
    expect(isResultadoAproximado(null)).toBe(false)
    expect(isResultadoAproximado(undefined)).toBe(false)
  })
})
