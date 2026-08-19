// Conteúdo do Modo de Aprendizado Interativo — Onda 1 (Story 1.8).
//
// Regra editorial (Artigo IV — No Invention, ver docs/opportunity-mapping.md
// seção 7.2 e docs/research/2026-08-17-fundamentos-faturamento-cbhpm/): toda
// afirmação de regra CBHPM aqui tem fonte na seção correspondente de
// 02-research-report.md, que por sua vez é leitura direta dos PDFs oficiais
// (fonte primária, não paráfrase de terceiro). Nenhuma afirmação nova além do
// que o relatório cobre com confiança ALTA. Nunca citar número de item sem
// citar também a edição — a numeração interna das Instruções Gerais está
// defasada entre edições (ver seção 3.6 do relatório, nota de rastreabilidade).
//
// 2026-08-18: texto revisado a pedido do usuário para tirar travessão longo
// (mesma regra já usada no chat, ver src/app/api/chat/route.js) e deixar a
// explicação mais didática. Nas fontes, o separador virou "·", mesma
// convenção já usada no "Exemplo ao vivo" (src/app/aprender/page.jsx).

export const RELATORIO_PESQUISA = 'docs/research/2026-08-17-fundamentos-faturamento-cbhpm/02-research-report.md'

// Procedimento real usado como exemplo ao vivo nos 4 blocos — buscado do
// banco em tempo real via /api/search, nunca hardcoded como resultado.
// Escolhido por ter porte, UCO, múltiplos auxiliares e porte anestésico
// todos presentes na mesma linha, cobrindo os 4 blocos com uma única busca.
//
// 2026-08-19: edição do exemplo trocada de CBHPM 2018 para CBHPM 2016 a
// pedido do usuário ("a gente usa até a de 2016 mesmo") — é a edição que a
// operação do usuário realmente fatura, então o exemplo ao vivo deve
// refletir o percentual de auxiliar que ele usa no dia a dia (30/20/20/20),
// não o da 2018/2022 (60/40/30/30). O mesmo código existe nas duas edições
// com todos os campos necessários (confirmado via /api/search).
export const CODIGO_EXEMPLO = '3.02.05.28-0'
export const VERSAO_EXEMPLO = 'CBHPM 2016'

export const TOPICOS = [
  {
    id: 'porte',
    titulo: 'O que é Porte',
    paragrafos: [
      {
        texto: 'Cada procedimento tem um código no formato X.XX.XX.XX-D: capítulo, subcapítulo, grupo e item, terminando num dígito verificador. Na tabela abaixo, os três primeiros procedimentos (consulta em consultório, em domicílio e em pronto socorro) só mudam no par de números antes do dígito final: é o mesmo grupo "Consultas", itens diferentes.',
        fonte: 'Observação estrutural direta, comparando os códigos da própria tabela (não é uma regra numerada das Instruções Gerais)',
        imagem: {
          src: '/aprendizado/cbhpm-3ed-consultas.png',
          alt: 'Recorte da tabela CBHPM 3ª edição, seção Consultas, mostrando códigos, procedimentos e porte',
          legenda: 'Recorte de CBHPM, 3ª edição, seção "Consultas" (p. 20)',
        },
      },
      {
        texto: 'No Glisse AI, você pesquisa por código (com ou sem pontuação, ex: "1.01.01.01-2" ou "10101012") ou por parte do nome do procedimento (ex: "consulta consultório"). Selecione a edição da CBHPM antes de buscar: o mesmo código pode ter porte e valor diferentes em cada edição.',
        fonte: 'Funcionalidade do Glisse AI (não é regra da CBHPM)',
      },
      {
        texto: 'O porte não representa dinheiro. Ele só estabelece uma comparação entre procedimentos quanto à complexidade técnica, tempo de execução, atenção requerida e grau de treinamento do profissional.',
        fonte: 'CBHPM, item 1.2 (texto idêntico da 3ª edição à 2022) · relatório seção 3.1',
      },
      {
        texto: 'A pontuação dos procedimentos está agrupada em 14 portes e três subportes (A, B e C). Os portes anestésicos são um conjunto separado, de 0 a 8, com correspondência própria para os demais portes.',
        fonte: 'CBHPM 2018, item 1.3 · relatório seção 3.2',
      },
      {
        texto: 'O valor em reais do porte não vem da edição da tabela: vem do Comunicado Oficial da AMB, que atualiza os valores em calendário separado. Por isso existe, por exemplo, "CBHPM 2018 com valores 2020-2021": a estrutura da tabela e o preço mudam em datas diferentes.',
        fonte: 'Comunicado Oficial AMB (ex.: Porte CBHPM 2018.pdf) · relatório seção 3.4',
      },
      {
        texto: 'Os valores publicados são referenciais MÍNIMOS, com banda de até 20% para mais ou para menos, sujeitos a negociação entre as partes. Por particular, a CBHPM é só referência; por convênio, vale o que o contrato define (normalmente "CBHPM edição X, a Y%").',
        fonte: 'CBHPM, item 1.3 · relatório seção 3.3',
      },
    ],
  },
  {
    id: 'quatro-numeros',
    titulo: 'Os Quatro Números de uma Linha',
    paragrafos: [
      {
        texto: 'Porte: remunera o cirurgião. É a base de todo o resto, pois auxiliares e, indiretamente, o anestesista são calculados a partir dele.',
        fonte: 'ver tópico "O que é Porte"',
      },
      {
        texto: 'Custo Operacional (UCO): cobre estrutura, como depreciação de equipamento, manutenção, mobiliário, imóvel, aluguel e folha de pagamento. NÃO cobre material descartável nem acessório: esses são negociados fora da tabela, diretamente entre as partes.',
        fonte: 'CBHPM 2018, item 1.3 · relatório seção 3.2',
      },
      {
        texto: 'Nº de Auxiliares: quantos médicos auxiliares o procedimento tem previsto, e o percentual que cada um recebe sobre o PORTE do cirurgião, nunca sobre porte + UCO.',
        fonte: 'CBHPM, item 5.1 · relatório seções 2.1 e 2.2',
      },
      {
        texto: 'Porte Anestésico: escala própria de 0 a 8 (0 = não participação do anestesiologista), com correspondência para um porte CBHPM equivalente, usada para remunerar o anestesista.',
        fonte: 'CBHPM, Instruções Gerais Específicas para a Anestesiologia, item 2 · relatório seção 3.5',
      },
    ],
  },
  {
    id: 'modificadores',
    titulo: 'Modificadores',
    paragrafos: [
      {
        texto: 'A regra: atos médicos em caráter de urgência ou emergência recebem acréscimo de 30% sobre o porte, entre 19h e 7h do dia seguinte, ou em qualquer horário aos sábados, domingos e feriados. Quando o atendimento começa no período normal e termina no período de urgência, o acréscimo só se aplica se mais da metade do procedimento foi feita no horário de urgência.',
        fonte: 'CBHPM 2018, Instruções Gerais, item 2.1 (regra da metade ausente na 3ª edição) · relatório seção 1.2',
      },
      {
        texto: 'O gatilho é o CARÁTER do atendimento, não o relógio: um procedimento eletivo feito às 22h não recebe o adicional. O acréscimo incide só sobre o porte, nunca sobre UCO ou o restante da conta.',
        fonte: 'CBHPM 2018, Instruções Gerais, item 2.1 · relatório seção 1.2',
      },
      {
        texto: 'Via de acesso, quando há mais de um procedimento no mesmo ato: mesma via de acesso, maior porte + 50% de cada um dos demais; vias diferentes, porte principal + 70% de cada um dos demais; cirurgia bilateral segue a mesma regra conforme a incisão; ato que é parte integrante de outro conta só o principal, não os dois.',
        fonte: 'CBHPM, item 4 das Instruções Gerais · relatório seção 3.6 (numeração de item varia entre edições: conferir sempre a edição específica antes de citar o número)',
      },
    ],
  },
  {
    id: 'quem-recebe',
    titulo: 'Quem Mais Recebe',
    paragrafos: [
      {
        texto: 'Auxiliares de cirurgia (edições 3ª a 2016): 30% da valoração do porte do cirurgião para o 1º auxiliar, 20% para o 2º e 3º, e também 20% para o 4º quando o caso exigir.',
        fonte: 'CBHPM, item 5.1 (texto da 2016) · relatório seção 2.1',
      },
      {
        texto: 'A CBHPM não publica nenhum critério geral de "por que" um procedimento paga ou não paga auxiliar. O número é atribuição normativa por procedimento, feita pelas Sociedades Brasileiras de Especialidade, e publicada como coluna da própria tabela, não uma decisão clínica caso a caso.',
        fonte: 'Verificação exaustiva nas edições disponíveis · relatório seção 2.4',
      },
    ],
  },
]
