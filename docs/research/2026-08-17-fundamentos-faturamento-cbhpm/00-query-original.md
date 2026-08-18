# Pergunta original

**Data:** 2026-08-17
**Solicitante:** dono do produto (faturista experiente)
**Agente:** @analyst (Atlas)
**Escopo:** SOMENTE PESQUISA. Nenhum código, nenhuma story, nenhuma implementação.

## Contexto

O Glisse AI é um sistema de consulta RAG sobre a tabela CBHPM, usado por faturistas para
consultar código, porte, valor, UCO, auxiliares e porte anestésico.

Foi pedida uma nova funcionalidade futura: um **modo interativo de aprendizado** dentro do app,
para treinar pessoas novas no faturamento médico. Esta pesquisa é a base de conteúdo dessa story
futura e precisa ser rigorosamente citável (Constitution, Artigo IV, "No Invention").

## O que já era conhecido (não pesquisado de novo)

- Porte é um código (ex: `4A`, `10C`) com valor em R$ atrelado por edição/vigência.
- UCO é multiplicador: valor final = `custo_operacional x valor_uco_da_edição`.
- Auxiliares: cada procedimento tem número tabelado e percentual de rateio
  (30/20/20/20 até 2016; 60/40/30/30 na 2018).
- Porte anestésico é campo numérico separado por procedimento.

## Perguntas de pesquisa

1. O que é "horário especial" no faturamento CBHPM: quando se aplica, como se calcula o
   acréscimo, se está na CBHPM ou é regra de convênio/contrato.
2. Regra completa de quando um procedimento paga ou não paga auxiliar de cirurgia:
   não só quantos, mas os critérios.
3. Outros fundamentos essenciais que um faturista iniciante precisa saber para operar com
   segurança (glosa, conta médica, convênio x particular, múltiplos procedimentos, etc.).

## Formato exigido

Relatório por tópico, cada afirmação com fonte (URL ou arquivo + trecho), sinalizando
claramente fonte oficial CBHPM/AMB versus terceiros. Terceiro que não bate com fonte oficial
deve ser marcado como "carece de confirmação".
