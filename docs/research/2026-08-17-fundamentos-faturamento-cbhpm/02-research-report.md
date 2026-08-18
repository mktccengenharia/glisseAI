# Fundamentos do faturamento médico via CBHPM

**Relatório de pesquisa** | 2026-08-17 | @analyst (Atlas)
**Finalidade:** base de conteúdo para o modo interativo de aprendizado do Glisse AI.
**Regra editorial:** nenhuma regra abaixo foi inventada. Cada afirmação tem fonte identificada
e nível de confiança declarado.

---

## 0. Classificação das fontes usadas

| Nível | Significado | Fontes deste relatório |
|---|---|---|
| **A. Oficial CBHPM/AMB** | Texto da própria tabela ou Comunicado Oficial da AMB | PDFs das 7 edições em `C:\Users\carme\OneDrive\Documentos\JOHN\tabelas_cbhpm\tabelas_cbhpm\` (3ª ed., 2008, 2010, 2014, 2015, 2016, 2018), CBHPM 2022 (SBOP), `PORTE CBHPM 2018.pdf`, `Porte CBHPM 2020-2021.pdf` |
| **B. Normativo oficial não-CBHPM** | ANS / CFM / CRM | ANS FHIR Tabela 35, ANS padrão TISS, Parecer CRM-PR 2724/2019 |
| **C. Contratual de operadora** | Manual de prestador, tabela de convênio | Manual Infraero Saúde |
| **D. Terceiro** | Blog, consultoria, fornecedor de software | Portal do Faturamento Hospitalar, ValidadorTISS, Rivio, cbhpm.com.br/wiki (Oazez), Amplimed |

Nível D **nunca** deve ser usado sozinho como regra dentro do produto. Está aqui só como
sinal de prática de mercado e sempre marcado.

**Nota metodológica importante:** as sete edições da CBHPM já estão em PDF no ambiente do
projeto e foram lidas diretamente com `pdftotext -layout` (mesma ferramenta do pipeline em
`scripts/cbhpm-import/01-extract-text.mjs`). Todas as citações "verbatim" abaixo vêm desse
texto extraído, não de terceiros. Isso torna a maior parte deste relatório nível A.

---

## 1. "Horário especial"

### 1.1. O termo "horário especial" NÃO existe na CBHPM

**Confiança: ALTA. Fonte: A (verificação exaustiva).**

Busca literal pelo termo em todas as edições disponíveis:

| Edição | Ocorrências de "horário especial" |
|---|---|
| 3ª edição | 0 |
| 2008 | 0 |
| 2010 | 0 |
| 2014 | 0 |
| 2015 | 0 |
| 2016 | 0 |
| 2018 | 0 |

O nome oficial do instituto na CBHPM é **"ATENDIMENTO DE URGÊNCIA E EMERGÊNCIA"**, item 2 das
Instruções Gerais. "Horário especial" é vocabulário de operadora/contrato, não da tabela.

> Implicação didática: ensinar o aluno que ele vai ouvir "horário especial" no dia a dia, mas
> que a regra que sustenta a cobrança se chama outra coisa na fonte. Quem recorre de glosa
> precisa citar "item 2 das Instruções Gerais da CBHPM", não "horário especial".

### 1.2. A regra oficial, na íntegra

**Confiança: ALTA. Fonte: A, CBHPM 2018, Instruções Gerais, item 2 (idem 2016 e 2022).**

> **2. ATENDIMENTO DE URGÊNCIA E EMERGÊNCIA**
>
> 2.1. Os atos médicos praticados em caráter de urgência ou emergência terão um acréscimo de
> trinta por cento (30%) em seus portes nas seguintes eventualidades:
> 2.1.1. No período compreendido entre 19h e 7h do dia seguinte;
> 2.1.2. Em qualquer horário aos sábados, domingos e feriados;
> 2.1.3. Ao ato médico iniciado no período normal e concluído no período de urgência/emergência,
> aplica-se o acréscimo de 30% quando mais da metade do procedimento for realizado no horário de
> urgência/emergência.

Três detalhes que costumam passar batido e são exatamente o que gera glosa:

1. **O acréscimo incide sobre o PORTE**, não sobre a conta inteira. O texto diz "acréscimo de
   trinta por cento (30%) **em seus portes**". Custo operacional / UCO não é mencionado.
2. **O gatilho é o caráter do atendimento**, não o relógio. O texto condiciona a
   "atos médicos praticados **em caráter de urgência ou emergência**". Procedimento eletivo
   feito às 22h não gera adicional (ver 1.4).
3. **A regra da metade (2.1.3)** resolve o caso da cirurgia que atravessa a virada do horário.

### 1.3. Diferença entre edições: a 3ª edição não tem a regra da metade

**Confiança: ALTA. Fonte: A, comparação direta dos textos.**

Na **CBHPM 3ª edição**, o item 2 tem apenas dois subitens:

> 2.1.1 No período compreendido entre 19h e 7h do dia seguinte;
> 2.1.2 Em qualquer horário aos sábados, domingos e feriados.

O subitem 2.1.3 (regra dos "mais da metade do procedimento") aparece a partir das edições mais
recentes; está presente e idêntico em 2016, 2018 e 2022. Como o Glisse AI cobre 7 edições, esta
é uma diferença real que o módulo de ensino deve mostrar, porque muda o que é defensável em
recurso de glosa dependendo da edição contratada.

### 1.4. Eletivo em horário noturno NÃO recebe o adicional

**Confiança: MÉDIA-ALTA. Fonte: C (contratual) + B (TISS).**

Manual do prestador da Infraero Saúde, seção "DO PAGAMENTO / Atendimento de urgência/emergência":

> "As cirurgias e os procedimentos realizados em caráter eletivo, mesmo durante os horários
> supramencionados, não se aplica o acréscimo de adicional de horário especial."

Isto é coerente com o texto oficial da CBHPM (que condiciona ao caráter de urgência), mas a
formulação explícita e o termo "adicional de horário especial" vêm do contrato, não da CBHPM.

O caráter do atendimento é campo obrigatório do padrão TISS, **Tabela 23**, com dois valores:
`1 - Eletivo` e `2 - Urgência/Emergência` (fonte D: Portal do Faturamento Hospitalar,
"O Faturamento e o Caráter de Atendimento"; a existência da Tabela 23 é padrão ANS/TISS).

### 1.5. As faixas de horário mudam conforme a tabela contratada

**Confiança: MÉDIA-ALTA. Duas fontes independentes concordam (C + D).**

| Tabela contratada | Faixa que dá direito ao adicional de 30% |
|---|---|
| **CBHPM** (todas as edições verificadas) | 19h às 7h do dia seguinte; sábados, domingos e feriados em qualquer horário |
| **AMB 92 / CIEFAS** | 22h às 6h do dia seguinte; domingo e feriado em qualquer horário |
| **AMB 90** | Segunda a sexta 19h às 7h; sábados a partir das 12h |

- Linha CBHPM: nível **A** (texto oficial, item 2.1.1 e 2.1.2).
- Linha AMB 92/CIEFAS: nível **C**, Manual Infraero ("Tabela AMB/92 e versões, o adicional será
  devido [...] no horário compreendido entre 22h e 6h do dia seguinte; domingo e feriado em
  qualquer horário"), corroborado por fonte D (Portal do Faturamento Hospitalar).
- Linha AMB 90: **apenas fonte D**. **Carece de confirmação com o usuário / com o contrato.**

> Ponto de ensino de alto valor: o mesmo procedimento, feito no mesmo horário, pode ter ou não
> adicional dependendo de qual tabela o convênio contratou. Sábado às 14h tem adicional pela
> CBHPM e não tem pela AMB 92.

### 1.6. Automação típica do lado da operadora

**Confiança: MÉDIA. Fonte: C (Manual Infraero), exemplo de UMA operadora.**

> "1. Campo Data/hora: Ao informar esse campo, o sistema já inclui o acréscimo conforme o horário
> especial de URGÊNCIA/EMERGÊNCIA (segundo tabela AMB/CBHPM) desde que os atributos do
> procedimento permitam horário de urgência e emergência."

Ou seja: existe um atributo por procedimento que autoriza ou não o adicional. Isso conecta com a
glosa 1723 citada abaixo. **Esse atributo não foi localizado em nenhuma coluna da CBHPM**, o que
sugere que é parametrização de operadora. Ponto a confirmar com o usuário.

### 1.7. Glosas associadas ao adicional

**Confiança: BAIXA-MÉDIA. Fonte: D apenas.**

| Código | Motivo |
|---|---|
| Glosa 1703 | Cobrança de adicional de urgência/emergência sem enquadramento nos horários e dias da tabela |
| Glosa 1723 | "Não previsibilidade de adicional de urgência para procedimento clínico" |

Fonte: Portal do Faturamento Hospitalar. Códigos de glosa não são padronizados nacionalmente da
mesma forma que a TUSS, então **carece de confirmação com o usuário** se esses códigos batem com
os que ele vê na prática.

### 1.8. Acréscimos que NÃO são horário especial (para não confundir o aluno)

**Confiança: ALTA. Fonte: A.**

Existem outros acréscimos percentuais na CBHPM que o iniciante confunde com horário especial:

| Acréscimo | Regra | Origem |
|---|---|---|
| +100% | Cirurgias em crianças com peso inferior a 2.500 g | item 4.6 (2016, 2018) |
| +100% (porte em dobro) | Paciente em apartamento/quarto privativo, hospital-dia ou UTI, em plano superior | item 6.2 |
| +30% | Anestesia em crianças até 12 anos ou idosos com 65 anos ou mais, **apenas** nos códigos 3.16.02.23-1, 3.16.02.24-0, 3.16.02.27-4 e 3.16.02.28-2 | Instruções Gerais Específicas para a Anestesiologia, item 14 (2018) |

Novidades exclusivas da **CBHPM 2022** (não valem para 3ª a 2018):

- 4.6 passa a incluir "ou nascidos anteriormente a 37 semanas gestacionais completas" (+100%);
- **4.7**: neonatos (0 a 28 dias) e lactentes (29 dias a 24 meses): **+50%**;
- **4.8**: pré-escolares até pediátrico (24 meses completos até 12 anos incompletos): **+30%**.

---

## 2. Auxiliar de cirurgia: quando paga, quanto paga, e por quê

### 2.1. Percentuais por edição (texto oficial verbatim)

**Confiança: ALTA. Fonte: A.**

**Edições 3ª, 2008, 2010, 2014, 2015 e 2016** (item 5.1, texto da 2016):

> "A valoração dos serviços prestados pelos médicos auxiliares dos atos cirúrgicos corresponderá
> ao percentual de **30%** da valoração do porte do ato praticado pelo cirurgião para o primeiro
> auxiliar, de **20%** para o segundo e terceiro auxiliares e, quando o caso exigir, também para
> o quarto auxiliar."

**Edições 2018 e 2022** (item 5.1, texto da 2018):

> "[...] corresponderá ao percentual de **60%** da valoração do porte ao ato praticado pelo
> cirurgião para o primeiro auxiliar, **40%** para o segundo auxiliar, **30%** para o terceiro e
> quando o caso exigir, também para o quarto auxiliar."

Isto **confirma** o que já está implementado no Glisse AI (30/20/20/20 até 2016; 60/40/30/30 na
2018) e estende a confirmação para a 2022.

### 2.2. A base de cálculo é o PORTE, não o total do procedimento

**Confiança: ALTA. Fonte: A.**

O texto diz "percentual de X% **da valoração do porte** do ato praticado pelo cirurgião". Custo
operacional (UCO), filme e porte anestésico **não entram** na base de rateio do auxiliar.

Isto é diretamente relevante para o produto: qualquer cálculo de auxiliar deve usar
`valor_porte`, nunca `valor_porte + custo_operacional`.

### 2.3. Múltiplos procedimentos no mesmo ato (item 5.2)

**Confiança: ALTA. Fonte: A, idêntico em todas as edições verificadas.**

> "5.2. Quando uma equipe, num mesmo ato cirúrgico, realizar mais de um procedimento, o número de
> auxiliares será igual ao previsto para o procedimento de **maior porte**, e a valoração do porte
> para os serviços desses auxiliares será calculada sobre a **totalidade dos serviços realizados
> pelo cirurgião**."

Traduzindo para o aluno:
- **Quantos auxiliares:** olha só o procedimento de maior porte. Não soma o número de auxiliares
  dos vários procedimentos.
- **Sobre quanto:** sobre o total do cirurgião, isto é, sobre o somatório já ponderado pelas
  regras de via de acesso (100% do principal + 50% ou 70% dos demais), não só sobre o principal.

Estes dois lados puxam em direções opostas e é um erro clássico de iniciante inverter os dois.

### 2.4. A resposta honesta sobre "por que este procedimento paga auxiliar"

**Confiança: ALTA (afirmação negativa verificada exaustivamente). Fonte: A.**

**A CBHPM não publica um critério geral.** Não existe, em nenhuma edição verificada, regra do
tipo "porte acima de X paga auxiliar" ou "cirurgia de cavidade paga auxiliar". O número de
auxiliares é **atribuição normativa por procedimento**, feita pelas Sociedades Brasileiras de
Especialidade, e está publicada como uma coluna da tabela.

Cabeçalho literal das tabelas do Capítulo 3 (CBHPM 2018):

```
                                                          Custo   N° de   Porte
Código        Procedimento                        Porte    Oper.   Aux.    Anest.
```

Exemplo real, primeira linha do Capítulo 3 da 2018:

```
3.01.01.97-2  Abdominoplastia pós-bariátrica      10A      –       2       5
3.01.01.01-8  Abrasão cirúrgica (por sessão)      3C       –       –       2
```

O traço (`–`) na coluna "N° de Aux." significa **ausência de auxiliar previsto**, e é diferente
de zero. Isto é coerente com a semântica já adotada no schema do projeto
(`supabase/schema.sql`, seção 6: "null = não se aplica").

> **Este é o achado mais importante para o módulo de ensino.** O produto pode e deve dizer:
> "o número de auxiliares deste procedimento é 2, conforme a coluna N° de Aux. da CBHPM {edição}".
> O produto **não** pode explicar o porquê clínico, porque a fonte não explica. Fingir um motivo
> seria violar o Artigo IV.

### 2.5. A única exceção encontrada: existe critério explícito, mas por grupo de procedimento

**Confiança: ALTA. Fonte: A, CBHPM 2018, observações do grupo de queimaduras.**

> "3. Número de auxiliares de cirurgia necessários para o tratamento:
> - 01 UT: não comporta auxílio;
> - 02 a 03 UTs: um auxiliar;
> - 04 ou mais UTs: dois auxiliares"

(UT = Unidade de Tratamento, definida no mesmo bloco de observações, com regra própria para
"área nobre/especial" valendo 2 UTs.)

A expressão "não comporta auxílio" aparece **uma única vez** em toda a CBHPM 2018, exatamente
aqui. Isso reforça 2.4: critérios existem, mas são pontuais, ficam nas observações do grupo, e
não formam uma regra geral.

> Ponto de ensino: quando o aluno quiser saber "por que", o caminho certo é ler as
> **observações do grupo** (código terminado em `.99-`), não procurar uma regra global.

### 2.6. Limite de auxiliares

**Confiança: ALTA para CBHPM (A). BAIXA para AMB (D).**

- CBHPM: até 4 auxiliares (item 5.1 cita explicitamente primeiro, segundo, terceiro e quarto).
- Tabela AMB: 3 auxiliares, "essa tabela não prevê o 4º auxiliar". Fonte D (ValidadorTISS).
  **Carece de confirmação com o usuário.**

### 2.7. Como o auxiliar é cobrado na prática (TISS)

**Confiança: ALTA para os códigos (B, ANS). MÉDIA para a prática de cobrança (D).**

Tabela 35 da TUSS, "Grau de participação" (fonte B, ANS FHIR):

| Código | Termo |
|---|---|
| 00 | Cirurgião |
| 01 | Primeiro Auxiliar |
| 02 | Segundo Auxiliar |
| 03 | Terceiro Auxiliar |
| 04 | Quarto Auxiliar |
| 05 | Instrumentador |
| 06 | Anestesista |
| 07 | Auxiliar de Anestesista |
| 08 | Consultor |
| 09 | Perfusionista |
| 10 | Pediatra na sala de parto |
| 11 | Auxiliar SADT |
| 12 | Clínico |
| 13 | Intensivista |

Prática de cobrança (fonte D, ValidadorTISS e Portal do Faturamento Hospitalar):
cada profissional entra em guia própria, com o **mesmo código de procedimento** e **grau de
participação distinto**. Repetir o mesmo grau em duas guias gera glosa por cobrança indevida;
cobrar mais auxiliares do que o procedimento comporta também.

Observação: o Manual Infraero (fonte C) remunera **Instrumentador a 10%**. Isso **não** está na
CBHPM. É cláusula contratual. Bom exemplo didático de "o contrato pode acrescentar, a tabela não
previu".

### 2.8. Auxiliar de anestesista é outra regra, com outros critérios

**Confiança: ALTA. Fonte: A, "Instruções Gerais Específicas para a Anestesiologia", item 8 (2018).**

> "8. Para os atos AN7 e AN8 ou naqueles nos quais seja utilizada Circulação Extracorpórea (CEC),
> ou procedimentos de neonatologia cirúrgica, gastroplastia para obesidade mórbida e cirurgias com
> duração acima de 6 horas, o anestesiologista responsável poderá, quando necessário, solicitar o
> concurso de um auxiliar (também anestesiologista), sendo atribuído a essa intervenção um porte
> correspondente a **60% dos portes previstos** para o(s) ato(s) realizados pelo anestesiologista
> principal."

Este é o **único lugar em toda a CBHPM** onde existe um critério objetivo de "quando cabe
auxiliar", e ele vale para o auxiliar do anestesista, não para o auxiliar do cirurgião. Vale a
pena ensinar exatamente assim, porque desfaz a confusão.

### 2.9. Quem decide se a cirurgia precisa de auxiliar: LACUNA

**Confiança: N/A. Sem fonte confiável encontrada.**

Uma busca inicial sugeriu que o Parecer CRM-PR 2724/2019 trataria disso. **A leitura do PDF
original mostrou que não trata.** O parecer tem por ementa "Ato anestésico - Valores relacionados
aos portes solicitados pelo cirurgião - Pagamento pelo procedimento de maior porte - CBHPM e
TUSS", e conclui sobre remuneração do anestesista em cirurgias múltiplas:

> "Acredito que as orientações da CBHPM são claras e não deixam dúvidas quanto a cobrança do ato
> anestésico. É um ato único, que tem um começo, meio e fim, independente de quantos procedimentos
> sejam realizados pelo cirurgião. [...] nada mais justo que o anestesista, que terá seu trabalho
> aumentado, possa também usufruir das mesmas prerrogativas."

(Parecer CRM-PR 2724/2019, Cons. Carlos Roberto Goytacaz Rocha, Curitiba, 28/01/2019.)

**Não encontrei parecer CFM/CRM citável sobre quem indica o auxiliar de cirurgia.** Fica como
pendência para levar ao usuário. Este é um caso concreto em que o resultado de busca resumido
por ferramenta estava errado e só a leitura da fonte primária revelou.

---

## 3. Fundamentos essenciais para o faturista iniciante

### 3.1. Porte não é dinheiro

**Confiança: ALTA. Fonte: A, item 1.2, texto idêntico da 3ª edição à 2022.**

> "Os portes representados ao lado de cada procedimento **não expressam valores monetários**,
> apenas estabelecem a comparação entre os diversos atos médicos no que diz respeito à sua
> complexidade técnica, tempo de execução, atenção requerida e grau de treinamento necessário
> para a capacitação do profissional que o realiza."

Esta é provavelmente a primeira coisa a ensinar. O porte é uma **posição numa hierarquia**. O
dinheiro vem de fora, do Comunicado Oficial da AMB (ver 3.3).

### 3.2. Estrutura de portes e a definição de UCO

**Confiança: ALTA. Fonte: A, item 1.3 (CBHPM 2018).**

> "A pontuação dos procedimentos médicos [...] está agrupada em **14 portes e três subportes
> (A, B e C)**. Os **portes anestésicos (AN) permanecem em número de oito** e mantém
> correspondência com os demais portes. Os portes de atos médicos laboratoriais seguem os mesmos
> critérios dos portes dos procedimentos, mas correspondem a **frações do menor porte (1A)**.
> Quanto aos custos, estabeleceu-se a **unidade de custo operacional (UCO)**, que incorpora
> depreciação de equipamentos, manutenção, mobiliário, imóvel, aluguéis, folha de pagamento e
> outras despesas comprovadamente associadas aos procedimentos médicos. [...] **Custos
> operacionais referentes a acessórios e descartáveis serão ajustados diretamente e de comum
> acordo entre as partes.**"

Três coisas ensináveis daqui:
1. UCO cobre **estrutura** (prédio, equipamento, folha), não cobre **material descartável**.
2. Descartável e acessório são negociados fora da tabela. Por isso a conta tem itens que a
   CBHPM não explica.
3. Exame laboratorial tem porte que é fração de 1A, e por isso "some" numa leitura desatenta.

### 3.3. Os valores são referenciais MÍNIMOS com banda de 20%

**Confiança: ALTA. Fonte: A, item 1.3 (CBHPM 2018/2022).**

> "A valoração dos portes e da UCO ficará sujeita a alteração sempre que modificadas as condições
> que nortearam suas fixações, sendo admitida **banda de até 20%, para mais ou para menos como
> valores referenciais mínimos**, em respeito à regionalização e a partir destes, os valores
> deverão ser **acordados por livre negociação entre as partes**."

Isto é a base jurídica do "deflator" / "percentual da tabela" que o faturista vê no contrato. É
também a resposta correta para **convênio versus particular**:

- **Particular:** não há tabela obrigatória. A CBHPM serve como referência.
- **Convênio:** vale o que o contrato diz, que normalmente é "CBHPM edição X, porte a Y%".
  O mesmo código pode valer valores diferentes em dois convênios no mesmo dia.

(Fonte D, cbhpm.com.br/wiki, ilustra o deflator: porte 2B de R$ 42,00 com 20% de redução
negociada resulta em R$ 33,60. Exemplo de cálculo, não norma.)

### 3.4. De onde vem o R$: o Comunicado Oficial da AMB

**Confiança: ALTA. Fonte: A, PDFs de porte no diretório de fontes do projeto.**

Exemplo, `PORTE CBHPM 2018.pdf`:

> "a Associação Médica Brasileira, por meio do seu Conselho de Defesa Profissional e da Câmara
> Técnica Permanente da CBHPM, avaliou a necessidade de se corrigir também a evolução dos Portes
> [...] concluiu pela adoção do INPC/IBGE do período, que corresponde a 3,97% [...] Quanto a
> unidade de Custo Operacional fica estabelecida **1 UCO = R$ 20,47**."
> (São Paulo, 29 de outubro de 2018.)

`Porte CBHPM 2020-2021.pdf`: índice INPC de 3,89%, **1 UCO = R$ 21,89**, 18 de outubro de 2020.

Ponto de ensino: **a estrutura da tabela (edição) e o valor do porte (comunicado) mudam em
calendários diferentes.** É por isso que existe "CBHPM 2018" com "valores 2020/2021". O schema do
projeto já modela isso corretamente (`cbhpm_versoes`, `cbhpm_porte_valores`, `valor_versao`).

**Divergência não resolvida:** a Rivio (fonte D) afirma UCO de **R$ 29,80 a partir de outubro de
2025**. Não localizei o Comunicado Oficial correspondente. **Carece de confirmação.**

### 3.5. Porte anestésico: a tabela de correspondência oficial

**Confiança: ALTA. Fonte: A, verificada em OITO edições.**

"Instruções Gerais Específicas para a Anestesiologia", item 2, no Capítulo 3 (Outros
Procedimentos Invasivos, bloco de observações `3.16.02.99-1`):

> "2. Neste trabalho, os atos anestésicos estão classificados em portes de 0 a 8, conforme as
> indicações do quadro abaixo:"

| Porte anestésico | Porte CBHPM correspondente |
|---|---|
| 0 | Anestesia local |
| 1 | 3A |
| 2 | 3C |
| 3 | 4C |
| 4 | 6B |
| 5 | 7C |
| 6 | 9B |
| 7 | 10C |
| 8 | 12A |

> "3. O porte anestésico '0' significa **'NÃO PARTICIPAÇÃO DO ANESTESIOLOGISTA'**."

Este quadro é **idêntico** nas edições 3ª, 2008, 2010, 2014, 2015, 2016, 2018 e 2022. Foi
verificado individualmente em cada uma.

Complementos oficiais do mesmo bloco:
- Item 4: se o ato médico não tem porte anestésico previsto na Classificação, a remuneração do
  anestesiologista equivale ao **PORTE 3**, código 3.16.02.34-7.
- Item 5: mesma via de acesso ou mesma cavidade anatômica, o porte do anestesista é o do maior
  porte **+ 50%** dos demais.
- Item 6: incisões ou orifícios naturais diferentes, **+ 70%** dos demais sobre o de maior porte.
- Item 7: cirurgia bilateral no mesmo ato anestésico sem código específico, **+ 70%**.
- Item 10: os portes do anestesista são "exclusivamente à intervenção pessoal, livre de quaisquer
  despesas", inclusive drogas, descartáveis, oxigênio.
- Item 12: consulta pré-anestésica em consultório dá direito ao porte de consulta clínica.

> **CONTRADIÇÃO IMPORTANTE COM FONTE DE TERCEIRO.** O blog da Rivio publica outra correspondência
> (1=3A, 2=3C, **3=5B, 4=7B, 5=9A**, 6=9B, **7=11C, 8=13C**). Isso **não confere** com nenhuma das
> oito edições oficiais verificadas. **A fonte de terceiro deve ser rejeitada.** Registrado aqui
> justamente para que ninguém a reintroduza depois achando que é dado novo.

### 3.6. Múltiplos procedimentos: as regras de via de acesso

**Confiança: ALTA. Fonte: A, item 4 das Instruções Gerais.**

| Situação | Regra | Item |
|---|---|---|
| Vários órgãos/regiões pela **mesma via de acesso** | Maior porte + **50%** de cada um dos demais, desde que não exista código específico para o conjunto | 4.1 |
| **Vias de acesso diferentes** | Porte da cirurgia principal + **70%** de cada um dos demais | 4.2 |
| Cirurgia **bilateral** | Mesma incisão 50%, incisões diferentes 70% | 4.3 |
| **Duas equipes distintas**, atos diferentes simultâneos | Cada equipe recebe o porte **integral** do seu procedimento | 4.4 |
| Ato cirúrgico que é **parte integrante de outro** | Valora-se **apenas o ato principal**, não o somatório | 4.5 |

O item 4.5 é a base da maior parte das glosas de "cobrança indevida por procedimento inerente".

Nota de rastreabilidade: várias observações de capítulo remetem a "item 6 das Instruções Gerais"
quando querem dizer as regras de via de acesso, mas nas edições 2016/2018/2022 o item 6 é
"Condições de Internação" e as regras de via de acesso estão no item 4. **A numeração interna das
remissões está defasada no próprio documento oficial.** Vale avisar o aluno, senão ele procura no
lugar errado.

### 3.7. Acomodação: porte em dobro

**Confiança: ALTA. Fonte: A, item 6.2.**

> "Para os planos superiores ofertados por operadoras [...] fica prevista a valoração do porte
> **pelo dobro** de sua quantificação, nos casos de pacientes internados em apartamento ou quarto
> privativo, em 'hospital-dia' ou UTI. **Não estão sujeitos às condições deste item os atos
> médicos do capítulo IV (Diagnósticos e Terapêuticos)**, exceto quando previstos em observações
> específicas do capítulo."

A exceção do Capítulo IV é a parte que o iniciante esquece, e é justamente o capítulo que o
Glisse AI importou recentemente (radiologia, medicina nuclear).

### 3.8. Pós-operatório de 10 dias já está no porte

**Confiança: ALTA. Fonte: A, item 3.1.**

> "Os portes atribuídos a cada procedimento cirúrgico incluem os cuidados pós-operatórios
> relacionados com o tempo de permanência do paciente no hospital, **até 10 (dez) dias** após o
> ato cirúrgico. Esgotado esse prazo, a valoração do porte passa ser regida conforme critérios
> estabelecidos para as visitas hospitalares (código 1.01.02.01-9), ou para as consultas em
> consultório (código 1.01.01.01-2)."

Cobrar visita ou consulta dentro dos 10 dias é motivo clássico de glosa.

### 3.9. Vídeo: a regra mudou entre edições

**Confiança: ALTA. Fonte: A, comparação direta.**

- **3ª edição, item 3.2:** "Os procedimentos cirúrgicos realizados por videolaparoscopia ou
  videoendoscopia terão portes correspondentes a **uma vez e meia** aos portes previstos nesta
  Classificação para os mesmos procedimentos realizados por técnica convencional."
- **2016, 2018, 2022, item 3.2:** "Os procedimentos cirúrgicos realizados por Vídeo têm portes
  **independentes** dos seus correlatos realizados por técnica convencional."

Em ambas as versões, procedimento **diagnóstico** por vídeo fica de fora do acréscimo de
múltiplos procedimentos.

Isto tem impacto direto no produto: para a 3ª edição, o porte tabelado do procedimento
convencional precisa ser multiplicado por 1,5; para 2016 em diante, o porte do procedimento por
vídeo já está tabelado com código próprio.

### 3.10. Taxa de sala e equipamento não estão na CBHPM

**Confiança: ALTA. Fonte: A, item 3.3 (2016, 2018, 2022).**

> "Nos procedimentos cirúrgicos e invasivos, a taxa de sala e a taxa de uso de equipamento, quando
> estas pertencerem ao hospital, devem ser **negociadas entre as partes interessadas** [...] Nos
> procedimentos videoassistidos, quando o equipamento pertencer à equipe médica, esta terá direito
> à taxa de uso de equipamento, **valorada na coluna 'Custo Operacional'**."

Esta é uma das poucas passagens oficiais que explica **para que serve** a coluna Custo Operacional
num procedimento cirúrgico.

### 3.11. Filme e documentação

**Confiança: MÉDIA. Fonte: D (cbhpm.com.br/wiki) + A (nomenclatura das colunas do Cap. 4).**

O cálculo do filme, segundo fonte D, é `quantidade especificada x valor do metro quadrado`. Não
localizei essa fórmula no texto das Instruções Gerais das edições verificadas.
**Carece de confirmação com o usuário**, que é quem sabe como o convênio dele paga filme.

Já a existência das colunas do Capítulo 4 (custo de filme/documentação, número de incidências,
unidade de radiofármaco) é fato do documento e está corretamente documentada em
`supabase/schema.sql`, seção 13.

### 3.12. O ecossistema: Rol, TUSS, TISS e CBHPM

**Confiança: ALTA para TISS (B, ANS). MÉDIA para as distinções didáticas (D).**

| Sigla | O que é | Tem valor em R$? |
|---|---|---|
| **Rol de Procedimentos (ANS)** | Lista de cobertura obrigatória dos planos | Não |
| **TUSS** | Terminologia Única da Saúde Suplementar: o código e o nome padronizados | Não |
| **TISS** | Padrão obrigatório de troca eletrônica de informação (XML, guias) | Não |
| **CBHPM** | Classificação hierarquizada: porte, custo operacional, auxiliares, porte anestésico | Sim, via Comunicado AMB |

Sobre o TISS (fonte B, ANS): "a Troca de Informações na Saúde Suplementar - TISS foi estabelecida
como um padrão **obrigatório** para as trocas eletrônicas de dados de atenção à saúde dos
beneficiários de planos, entre os agentes da Saúde Suplementar". Regulamentado atualmente pela
RN 501/2022.

Analogia útil, de fonte D, mas didaticamente correta: **TISS é a estrada, TUSS é a carga, CBHPM é
o preço.** O Rol diz o que o plano é obrigado a cobrir.

### 3.13. Glosa

**Confiança: MÉDIA. Fonte: D (Portal do Faturamento Hospitalar).**

Definição: a operadora **suspende o pagamento** de itens da conta (consultas, procedimentos,
materiais, medicamentos, taxas).

Dois grandes tipos:
- **Administrativa:** documentação, prazo, preenchimento de guia, autorização ausente.
- **Técnica:** codificação, pertinência clínica, regra de tabela.

Causas mais comuns citadas: erro de documentação, falta de informação no registro médico,
cobrança indevida, inconsistência entre contrato e serviço prestado, codificação incorreta,
cobrança sem autorização prévia, faturamento fora do prazo.

Recurso de glosa: analisar o motivo, e quando injustificada, recorrer com documentação que
comprove a legitimidade da cobrança.

Como esta seção é toda de nível D, o módulo de ensino deve tratá-la como **vocabulário e
prática de mercado**, não como norma. O usuário, que é faturista experiente, é a melhor fonte
para validar e enriquecer esta parte.

### 3.14. Autoridade interpretativa

**Confiança: ALTA. Fonte: A, item 7.2.**

> "As interpretações referentes à aplicação desta Classificação de Procedimentos serão efetuadas
> com **exclusividade pela Associação Médica Brasileira e suas Sociedades Brasileiras de
> Especialidade**."

Ou seja: em divergência de interpretação, blog não decide, software não decide, auditoria de
operadora não decide sozinha. Bom fecho para o módulo.

---

## 4. Contradições e pendências (levar ao usuário)

| # | Item | Status |
|---|---|---|
| 1 | **Correspondência de porte anestésico da Rivio** (3=5B, 4=7B, 5=9A, 7=11C, 8=13C) contradiz as 8 edições oficiais (3=4C, 4=6B, 5=7C, 7=10C, 8=12A) | **RESOLVIDO contra o terceiro.** Usar só a oficial |
| 2 | Faixa de horário da **tabela AMB 90** (sábado a partir das 12h) | Só fonte D. Confirmar com o usuário |
| 3 | **Códigos de glosa 1703 e 1723** | Só fonte D. Confirmar se batem com a prática dele |
| 4 | **UCO de R$ 29,80 a partir de out/2025** | Só fonte D (Rivio). Falta o Comunicado Oficial |
| 5 | **Limite de 3 auxiliares na tabela AMB** | Só fonte D. Confirmar |
| 6 | **Fórmula do filme** (quantidade x valor do m²) | Só fonte D. Confirmar como o convênio dele paga |
| 7 | **Quem indica o auxiliar de cirurgia** (médico ou operadora) | **SEM FONTE.** O parecer CRM-PR 2724/2019 trata de outro assunto |
| 8 | **Atributo de operadora que autoriza adicional de urgência** por procedimento (Manual Infraero) | Não localizado em nenhuma coluna da CBHPM. Provavelmente parametrização de operadora. Confirmar |
| 9 | **Acumulação de acréscimos** (urgência 30% + acomodação 100% + pediátrico) | Nenhuma edição diz se acumula, e em que ordem. Lacuna real da fonte oficial |
| 10 | Instruções Gerais das edições **2008, 2010, 2014, 2015** foram verificadas apenas nos pontos de auxiliar, urgência e porte anestésico | Verificação completa item a item não foi feita para essas quatro edições |

---

## 5. Índice de fontes

### Nível A: oficial CBHPM/AMB

Arquivos locais em `C:\Users\carme\OneDrive\Documentos\JOHN\tabelas_cbhpm\tabelas_cbhpm\`:
- `CBHPM 3ª EDIÇÃO.pdf`, `cbhpm 2008.pdf`, `CBHPM 2010.pdf`, `CBHPM 2014.pdf`,
  `CBHPM 2015.pdf`, `CBHPM 2016.pdf`, `CBHPM 2018.pdf`
- `PORTE CBHPM 2018.pdf` (Comunicado Oficial AMB, 29/10/2018, UCO R$ 20,47)
- `Porte CBHPM 2020-2021.pdf` (Comunicado Oficial AMB, 18/10/2020, UCO R$ 21,89)
- `PORTES CBHPM.pdf` (valoração comparada 2008/2010/2012/2014/2017)

Online:
- CBHPM 2022 (versão agosto/2023), publicada pela SBOP:
  https://sbop.com.br/wp-content/uploads/CBHPM-2022_versao-agosto-2023.pdf
- Instruções Gerais CBHPM (reprodução Unimed JF):
  https://www.unimedjf.coop.br/Arquivos/Area_restrita/CBHPM/Instrucoes_CBHPM.pdf
- Instruções Gerais CBHPM 2022 (reprodução IBL Audit):
  https://iblaudit.com.br/wp-content/uploads/2025/03/Instrucoes_Gerais_CBHPM-2022.pdf
  (indisponível no momento da pesquisa, DNS não resolveu)

### Nível B: normativo oficial não-CBHPM

- ANS, Tabela 35 TUSS "Grau de participação": https://fhir-hm.ans.gov.br/CodeSystem-tuss-35.html
- ANS, padrão TISS: https://www.gov.br/ans/pt-br/assuntos/prestadores/padrao-para-troca-de-informacao-de-saude-suplementar-2013-tiss
- ANS, RN 501/2022: https://bvsms.saude.gov.br/bvs/saudelegis/ans/2022/res0501_01_04_2022.html
- CFM/CRM-PR, Parecer 2724/2019 (honorário de anestesista em cirurgias múltiplas):
  https://sistemas.cfm.org.br/normas/arquivos/pareceres/PR/2019/2724_2019.pdf

### Nível C: contratual de operadora

- Infraero Saúde, Manual para o Prestador de Serviços e Eventos de Saúde:
  https://transparencia.infraero.gov.br/wp-content/uploads/2019/02/manual_prestador.pdf
  (seções "DO PAGAMENTO / Atendimento de urgência/emergência" e "fatores de redução e acréscimo")

### Nível D: terceiros

- Portal do Faturamento Hospitalar, "O Faturamento e o Caráter de Atendimento":
  https://www.portaldofaturamentohospitalar.com/2020/06/faturamento-carater-atendimento.html
- Portal do Faturamento Hospitalar, "Entendendo as Glosas no Faturamento Médico-Hospitalar":
  https://www.portaldofaturamentohospitalar.com/2024/04/entendendo-as-glosas-no-faturamento.html
- Portal do Faturamento Hospitalar, "Auxiliares de Cirurgia e o Percentual de Cobrança":
  https://www.portaldofaturamentohospitalar.com/2023/05/auxiliares-de-cirurgia-e-o-percentual.html
- ValidadorTISS, "Honorários dos Auxiliares de Cirurgia":
  https://www.validadortiss.com.br/honorarios-auxiliares-cirurgia-regras-cobranca/
- Rivio, "Como são calculados os honorários de anestesista":
  https://www.rivio.com.br/blog/honorario-anestesista
  **ATENÇÃO: publica correspondência de porte anestésico divergente das 8 edições oficiais.**
- CBHPM Wiki (Oazez), "Cálculo Básico de Procedimentos Médicos":
  https://www.cbhpm.com.br/wiki/index.php?title=C%C3%A1lculo_B%C3%A1sico_de_Procedimentos_M%C3%A9dicos
- SBAM, "Instruções gerais da tabela CBHPM, como aplicar?":
  https://www.sbam.org.br/noticia/47/instrucoes-gerais-da-tabela-cbhpm-como-aplicar
  (retornou HTTP 403 na coleta, não foi possível ler)
