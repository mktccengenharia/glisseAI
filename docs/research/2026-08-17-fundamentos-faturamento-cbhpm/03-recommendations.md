# Recomendações para a story futura do modo de aprendizado

**Escopo:** recomendações de conteúdo e de risco. **Nenhum código.** A priorização é do @pm e a
implementação é do @dev.

---

## 1. Achado com impacto imediato no produto, independente do modo de aprendizado

### 1.1. O porte anestésico PODE ser convertido em R$ com os dados que já estão no banco

A correspondência oficial porte anestésico -> porte CBHPM (0 = anestesia local, 1 = 3A, 2 = 3C,
3 = 4C, 4 = 6B, 5 = 7C, 6 = 9B, 7 = 10C, 8 = 12A) está publicada no próprio texto da CBHPM e é
**idêntica nas oito edições verificadas** (3ª, 2008, 2010, 2014, 2015, 2016, 2018, 2022).

Isso significa que `porte_anestesico` + `cbhpm_porte_valores` já bastam para exibir o valor do
ato anestésico, sem importar nenhuma tabela nova. Este é um dado determinístico, com fonte
oficial, e não viola o Artigo IV.

Observação de precisão: continua **não** existindo "valor total do procedimento". O porte
anestésico remunera o anestesista, não o cirurgião. A recomendação é exibir como linha própria e
rotulada, nunca somada ao honorário do cirurgião.

Isto corrige um pressuposto anterior de que a tabela de preços do ato anestésico não existiria.
Ela não precisa existir: a correspondência está na fonte.

### 1.2. Rejeitar explicitamente a correspondência publicada pela Rivio

O blog da Rivio publica outra tabela (3 = 5B, 4 = 7B, 5 = 9A, 7 = 11C, 8 = 13C) que não confere
com nenhuma edição oficial. Se alguém no futuro trouxer esse dado como "melhoria", ele deve ser
recusado. Está registrado no relatório justamente para isso.

---

## 2. Como estruturar o conteúdo do modo de aprendizado

A pesquisa sugere naturalmente uma progressão em cinco blocos, do conceito para a exceção:

| Bloco | Conteúdo | Nível de fonte |
|---|---|---|
| 1. O que é porte | Porte não é dinheiro (item 1.2). 14 portes, 3 subportes. Onde o R$ entra (Comunicado AMB) | A, 100% citável |
| 2. Os quatro números de uma linha | Porte, Custo Operacional (UCO), N° de Aux., Porte Anestésico. O que cada um paga e a quem | A |
| 3. Os modificadores | Urgência 30%, via de acesso 50/70%, acomodação em dobro, pediátrico | A |
| 4. Quem mais recebe | Auxiliares (percentuais por edição), anestesista, auxiliar de anestesista | A |
| 5. O mundo fora da tabela | Rol, TUSS, TISS, contrato, deflator, glosa | B para TISS, D para o resto |

Os blocos 1 a 4 são quase inteiramente citáveis com fonte oficial. O bloco 5 é o mais frágil e
é onde o conhecimento do usuário deve entrar como fonte primária declarada.

---

## 3. Restrições de conteúdo, derivadas do Artigo IV

1. **Nunca explicar "por que" um procedimento paga auxiliar.** A CBHPM não publica critério
   geral. O produto pode dizer o número tabelado e citar a coluna; não pode inventar a razão
   clínica. A única resposta correta é: "está atribuído pela Sociedade de Especialidade e
   publicado na coluna N° de Aux.".

2. **Sempre amarrar a regra à edição.** Percentual de auxiliar, regra de vídeo, acréscimos
   pediátricos e presença do item 2.1.3 mudam entre edições. Uma lição que não diz "na edição X"
   está errada em pelo menos uma das sete edições cobertas pelo app.

3. **Separar "CBHPM diz" de "o contrato diz".** Horário especial, deflator, instrumentador a 10%
   e códigos de glosa são contrato ou prática. Misturar isso com o texto oficial é exatamente o
   erro que gera confiança indevida num faturista iniciante.

4. **Marcar visualmente o nível de fonte.** O relatório já classifica A/B/C/D. Manter essa
   distinção no conteúdo entregue ao aluno protege o produto.

---

## 4. Riscos identificados

| Risco | Descrição | Mitigação sugerida |
|---|---|---|
| **Ensinar cálculo e virar cobrança** | Um módulo que ensina "urgência = +30%" pode ser lido como autorização para cobrar | Enquadrar como material de estudo, com a regra sempre citada e a ressalva de contrato |
| **Conteúdo de nível D dentro de um produto que promete 100% de precisão** | Glosa, filme e faixas AMB só têm fonte de terceiro | Ou validar com o usuário, ou marcar explicitamente como "prática de mercado, confirme com seu contrato" |
| **Defasagem de numeração da própria CBHPM** | Observações de capítulo remetem a "item 6 das Instruções Gerais" quando querem dizer o item 4 | Não construir navegação automática por número de item |
| **Conteúdo estático desatualizando** | Comunicados AMB saem anualmente | Ancorar o conteúdo em conceito, e os valores em `cbhpm_porte_valores`, nunca em número escrito no texto da lição |

---

## 5. Perguntas para levar ao usuário antes da story

1. As faixas de horário da AMB 90 (sábado a partir das 12h) batem com o que você vê?
2. Os códigos de glosa 1703 e 1723 aparecem nos seus demonstrativos?
3. Como o seu convênio paga filme? Por metro quadrado, por unidade, ou pacote?
4. Qual edição da CBHPM cada convênio de vocês contratou? Isso define quais lições são relevantes.
5. Existe alguma regra do dia a dia de vocês que você sabe que é do contrato e não da tabela, e
   que um novato sempre erra? Essa é a lição de maior valor e não está em nenhuma fonte pública.
6. O adicional de urgência acumula com o dobro de acomodação nos contratos de vocês? A CBHPM não
   diz, e isso é decisão contratual.

---

## 6. Próximos passos

- **@pm (Morgan):** priorizar o modo de aprendizado no backlog e decidir escopo (blocos 1 a 4
  primeiro, bloco 5 depois da validação com o usuário).
- **@po (Pax) / @sm (River):** transformar os blocos em critérios de aceite, com a regra de que
  cada afirmação da lição referencie item e edição.
- **@dev (Dex):** nada a fazer nesta etapa. O único item com valor técnico independente é a
  correspondência de porte anestésico (seção 1.1), que merece story própria e separada do módulo
  de ensino.
