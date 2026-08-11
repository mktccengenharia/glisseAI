export class CBHPMAssistantRAG {
  constructor(searchEngine) {
    this.searchEngine = searchEngine;
  }

  /**
   * Processa a mensagem do usuário e gera uma resposta estilo "Claude"
   * garantindo respostas precisas, amigáveis e fundamentadas no banco de dados.
   * @param {string} userMessage Texto enviado pelo usuário no chat
   * @param {string} selectedVersion Versão da tabela selecionada na UI
   */
  async processQuery(userMessage, selectedVersion = 'ALL') {
    if (!userMessage || !userMessage.trim()) {
      return {
        text: "Como posso ajudar na sua consulta médica hoje? Digite um **código** (ex: `3.01.01.00-7`) ou o **nome do procedimento**.",
        cards: []
      };
    }

    const trimmedMsg = userMessage.trim();
    
    // Executa a busca estruturada
    const results = this.searchEngine.search(trimmedMsg, selectedVersion);

    if (results.length === 0) {
      return {
        text: `Nenhum procedimento foi encontrado para a busca **"${trimmedMsg}"** na versão selecionada (**${selectedVersion === 'ALL' ? 'Todas as tabelas' : selectedVersion}**).\n\nDica: Tente buscar por palavras-chave parciais ou verifique se o número do código está correto.`,
        cards: []
      };
    }

    if (results.length === 1) {
      const item = results[0];
      const formatCurrency = (val) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

      const replyText = `Localizei o procedimento solicitado:\n\n` +
        `**Procedimento:** ${item.procedimento}\n` +
        `**Código CBHPM:** \`${item.codigo}\`\n` +
        `**Porte:** \`${item.porte}\` (${formatCurrency(item.valorPorteR$)})\n` +
        `**UCO:** ${item.uco} UCOs (${formatCurrency(item.valorUcoR$)})\n` +
        `**Anestesia:** ${item.anestesia !== "0" ? item.anestesia : "Sem anestesia (0)"}\n` +
        `**Versão da Tabela:** ${item.versao}\n` +
        (item.observacao ? `**Observação:** ${item.observacao}\n` : '');

      return {
        text: replyText,
        cards: [item]
      };
    }

    // Múltiplos resultados encontrados
    const formatCurrency = (val) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    let summaryText = `Encontrei **${results.length} procedimento(s)** relacionados à sua busca **"${trimmedMsg}"**:\n\n`;

    results.slice(0, 5).forEach((item, idx) => {
      summaryText += `${idx + 1}. **${item.procedimento}**\n`;
      summaryText += `   • Código: \`${item.codigo}\` | Porte: \`${item.porte}\` (${formatCurrency(item.valorPorteR$)}) | UCO: ${item.uco}\n`;
    });

    if (results.length > 5) {
      summaryText += `\n*Exibindo os 5 resultados mais relevantes.*`;
    }

    return {
      text: summaryText,
      cards: results
    };
  }
}
