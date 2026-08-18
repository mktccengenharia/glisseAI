# Pesquisa: fundamentos do faturamento médico via CBHPM

**Data:** 2026-08-17 | **Agente:** @analyst (Atlas) | **Tipo:** pesquisa, sem implementação
**Motivação:** base de conteúdo para a story futura do modo interativo de aprendizado do Glisse AI.

## TL;DR

1. **"Horário especial" não existe na CBHPM.** O termo tem zero ocorrências nas sete edições do
   repositório. O nome oficial é "Atendimento de urgência e emergência", item 2 das Instruções
   Gerais: acréscimo de **30% sobre o porte** entre 19h e 7h, e em qualquer horário aos sábados,
   domingos e feriados. O gatilho é o **caráter** do atendimento, não o relógio: eletivo à noite
   não recebe adicional.

2. **A CBHPM não publica critério para saber se um procedimento paga auxiliar.** O número está
   tabelado por procedimento na coluna `N° de Aux.`, atribuído pelas Sociedades de Especialidade.
   Traço (`–`) significa ausência de auxiliar previsto. A única regra com critério explícito que
   encontrei em toda a edição 2018 está nas observações do grupo de queimaduras (por Unidade de
   Tratamento). Portanto o produto pode informar o número, mas **não pode explicar o porquê**.

3. **Achado de alto valor:** a correspondência oficial **porte anestésico -> porte CBHPM**
   (1 = 3A, 2 = 3C, 3 = 4C, 4 = 6B, 5 = 7C, 6 = 9B, 7 = 10C, 8 = 12A) está no texto da própria
   CBHPM e é **idêntica em oito edições**. Isso permite converter `porte_anestesico` em R$ com os
   dados já presentes no banco, sem importar nada novo.

4. **Um blog conhecido publica essa correspondência errada.** A Rivio traz 3 = 5B, 4 = 7B,
   5 = 9A, 7 = 11C, 8 = 13C, o que não confere com nenhuma edição oficial. Fonte rejeitada e
   registrada para não voltar como "melhoria".

5. Os percentuais de auxiliar já implementados no app estão **confirmados no texto oficial**
   (30/20/20/20 até 2016; 60/40/30/30 na 2018) e a confirmação se estende à edição 2022.

## Arquivos

| Arquivo | Conteúdo |
|---|---|
| [00-query-original.md](00-query-original.md) | Pergunta original e escopo |
| [02-research-report.md](02-research-report.md) | Relatório completo por tópico, com fontes e nível de confiança |
| [03-recommendations.md](03-recommendations.md) | Implicações para a story futura, riscos e perguntas ao usuário |

## Confiança por tópico

| Tópico | Confiança | Base |
|---|---|---|
| Regra de urgência/emergência (30%) | **ALTA** | Texto oficial CBHPM, verbatim, 4 edições |
| Percentuais de auxiliar por edição | **ALTA** | Texto oficial CBHPM, verbatim, 8 edições |
| Correspondência de porte anestésico | **ALTA** | Texto oficial CBHPM, 8 edições, idêntico |
| Regras de via de acesso (50/70%) | **ALTA** | Texto oficial CBHPM, item 4 |
| Definições de porte, UCO, banda de 20% | **ALTA** | Texto oficial CBHPM, item 1 |
| Faixas de horário por tabela (AMB 90/92) | **MÉDIA** | Manual de operadora + blog |
| Tabela 35 TUSS (grau de participação) | **ALTA** | ANS FHIR |
| Glosa: tipos, causas, códigos | **BAIXA-MÉDIA** | Apenas blogs |
| Fórmula do filme | **BAIXA** | Apenas blog |
| Quem indica o auxiliar de cirurgia | **SEM FONTE** | Pendência |

## Método

As sete edições da CBHPM já estavam em PDF no ambiente do projeto e foram lidas diretamente com
`pdftotext -layout`, a mesma ferramenta do pipeline de importação. A CBHPM 2022 foi baixada da
publicação da SBOP. A maior parte deste relatório é, portanto, fonte primária e não paráfrase de
terceiros. Buscas web foram usadas para o que a tabela não cobre: contrato, TISS, glosa.

**Aviso de método:** em um caso concreto o resumo automático de um resultado de busca estava
errado (atribuiu ao Parecer CRM-PR 2724/2019 uma conclusão sobre auxiliar de cirurgia, quando o
parecer trata de honorário de anestesista). Só a leitura do PDF original revelou. Isso reforça a
regra de não aceitar fonte de terceiro sem verificação.
