// Regras de exibição do dado de procedimento (Story 1.6 — fidelidade do dado).
//
// Vive fora de src/app/page.jsx por dois motivos: (1) a suíte roda em ambiente
// `node` (ver vitest.config.mjs), sem DOM, então a lógica de decisão precisa
// ser testável sem renderizar React; (2) a convenção "Não consta na fonte"
// passou a ser usada em vários campos e precisa de uma definição única.
//
// Princípio que orienta todo este módulo (Article IV — No Invention): o que a
// tela mostra tem que corresponder ao que a fonte CBHPM traz. Nenhuma função
// aqui inventa, converte ou substitui valor ausente por um valor plausível.

// Convenção já usada pelo card para `numero_auxiliares` desde a Story 1.3 e
// pelo texto do chat (src/app/api/chat/route.js).
export const NAO_CONSTA = 'Não consta na fonte'

// null/undefined = a fonte não traz esse dado para esse código.
// Diferente de 0, que é dado presente e igual a zero. Nunca coagir um no outro
// (era exatamente o que `|| 0` e `|| '-'` faziam antes desta story).
export function isAusente(value) {
  return value === null || value === undefined
}

// Campos de texto opcionais: string vazia ou só espaço também não é dado.
export function isAusenteTexto(value) {
  return isAusente(value) || (typeof value === 'string' && value.trim() === '')
}

// Valores monetários (valor_porte, valor_uco). `0` continua virando "R$ 0,00".
export function formatValorBRL(value) {
  if (isAusente(value)) return NAO_CONSTA
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// Percentual de rateio de auxiliares por edição: 30/20/20/20 até 2016,
// 60/40/30/30 na 2018 (CBHPM, item 5.1 — ver docs/research/2026-08-17-
// -fundamentos-faturamento-cbhpm/02-research-report.md seção 2.1). Vem do
// próprio registro (`aux_pct`); este é só o fallback para registro antigo
// sem esse campo populado.
export const DEFAULT_AUX_PCT = [0.3, 0.2, 0.2, 0.2]

// Valor de UM auxiliar: percentual sobre o PORTE do cirurgião — nunca sobre
// porte + custo operacional (relatório seção 2.2, "a base de cálculo é o
// PORTE, não o total do procedimento"). null quando valor_porte for ausente,
// para não inventar 0 a partir de `null * pct` (Story 1.6, AC1).
export function valorAuxiliar(valorPorte, pct) {
  return isAusente(valorPorte) ? null : valorPorte * pct
}

// Campos numéricos SEM unidade monetária. `uco`, `custo_operacional` e
// `custo_filme_doc` são multiplicadores da fonte, não valores em reais —
// formatá-los como R$ seria inventar uma unidade que a CBHPM não dá.
// Reproduzido literalmente (String) para não introduzir arredondamento nem
// troca de separador decimal em cima do dado bruto.
export function formatNumero(value) {
  if (isAusente(value)) return NAO_CONSTA
  return String(value)
}

// unidade_radiofarmaco é texto e quase sempre vem como "*", remetendo a uma
// tabela de preços EXTERNA do Colégio Brasileiro de Radiologia
// (supabase/schema.sql, seção 13). Renderizar literalmente: nunca interpretar,
// converter em número ou substituir por um valor inventado.
export function formatUnidadeRadiofarmaco(value) {
  return String(value)
}

// Texto que explica ao faturista o que o "*" significa, sem simular o preço.
export const LEGENDA_UNIDADE_RADIOFARMACO =
  'Conforme a fonte. "*" remete à tabela de preços do Colégio Brasileiro de Radiologia, externa a esta tabela.'

// ─── Campos do Capítulo 4 (Radiologia / Medicina Nuclear) ──────────────────
//
// Política de `null` deliberadamente diferente da dos valores em R$: aqui o
// campo é OMITIDO quando ausente, em vez de exibir "Não consta na fonte".
// Esses campos só se aplicam a Radiologia/Medicina Nuclear — exibir "não
// consta" em todo procedimento fora desses grupos viraria ruído em ~80% da
// base. Ver Story 1.6, notas de validação do @po.
//
// `custo_operacional` NÃO está aqui de propósito (removido por decisão do
// usuário em 2026-08-17, gate UX-001): os scripts de import gravam
// `uco: r.custo_operacional` — é sempre o mesmo número que o card já mostra
// no bloco "UCO" acima. Listar os dois como campos separados fazia o mesmo
// valor parecer dois itens cobráveis distintos, risco real num app de
// faturamento. O campo continua no banco e no cálculo de valor_uco, só não é
// exibido em duplicidade.
export const CAMPOS_CAPITULO_4 = [
  { key: 'custo_filme_doc', label: 'Custo Filme/Documentação', format: formatNumero },
  { key: 'numero_incidencias', label: 'Nº de Incidências', format: formatNumero },
  {
    key: 'unidade_radiofarmaco',
    label: 'Unidade de Radiofármaco (UR)',
    format: formatUnidadeRadiofarmaco,
    legenda: LEGENDA_UNIDADE_RADIOFARMACO,
  },
]

// Devolve só os campos do Capítulo 4 que a fonte realmente trouxe, já
// formatados. `0` conta como presente e é exibido.
export function camposCapitulo4Presentes(item) {
  if (!item) return []
  return CAMPOS_CAPITULO_4.filter((campo) => !isAusenteTexto(item[campo.key])).map((campo) => ({
    key: campo.key,
    label: campo.label,
    value: campo.format(item[campo.key]),
    legenda: campo.legenda ?? null,
  }))
}

// ─── Contagem de resultados (AC3) ──────────────────────────────────────────

// Teto de renderização, alinhado ao `limit(10)` que todas as rotas de busca já
// usam (src/app/api/search/route.js). A UI cortava em 5 e descartava metade
// dos resultados em silêncio.
export const MAX_CARDS_EXIBIDOS = 10

// A mensagem NUNCA pode afirmar nem sugerir que a lista é exaustiva quando
// bate no teto: o corte de 10 é do banco, não só da UI, e esta story não
// resolve essa raiz (ver ZC-07 no backlog).
export function resumoResultados(total) {
  if (!Number.isFinite(total) || total <= 0) return null
  if (total === 1) return '1 resultado encontrado.'
  if (total < MAX_CARDS_EXIBIDOS) return `${total} resultados encontrados.`
  return (
    `Mostrando ${total} resultados, que é o máximo devolvido por consulta. ` +
    'Pode haver outros que não couberam neste limite: refine o termo ou selecione uma edição específica.'
  )
}

// ─── Rótulo de resultado aproximado (AC4) ──────────────────────────────────

// Ramo da cascata de busca que produziu o resultado. Vem de /api/search, que
// sabe qual camada respondeu — nunca de um limiar de similaridade (a RPC
// semântica não devolve score sem trocar de assinatura; ver Story 1.6,
// restrição técnica 1).
export const MATCH_SEMANTICO = 'semantico'

export function isResultadoAproximado(matchType) {
  return matchType === MATCH_SEMANTICO
}

export const AVISO_RESULTADO_APROXIMADO =
  'Resultado aproximado: nenhum código nem texto de procedimento bateu com o que você digitou. ' +
  'Estes itens foram encontrados por semelhança de significado e podem não ser o procedimento procurado. ' +
  'Confira o código e o nome na fonte antes de faturar.'

export const SELO_RESULTADO_APROXIMADO = 'Resultado aproximado'
