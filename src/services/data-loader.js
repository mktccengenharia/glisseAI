/**
 * Módulo Data Loader para Importação de Tabelas CBHPM (CSV, TSV, JSON)
 */
export class CBHPMDataLoader {
  /**
   * Faz o parse de arquivo texto (CSV / TSV)
   * @param {string} textContent Conteúdo bruto do arquivo
   * @param {string} defaultVersionNome Nome da versão a atribuir aos dados
   */
  static parseCSV(textContent, defaultVersionNome = "CBHPM Importada") {
    if (!textContent) return [];

    const lines = textContent.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length <= 1) return [];

    // Detecta separador (vírgula, ponto e vírgula ou tab)
    const headerLine = lines[0];
    let separator = ',';
    if (headerLine.includes(';')) separator = ';';
    else if (headerLine.includes('\t')) separator = '\t';

    const headers = headerLine.split(separator).map(h => h.trim().toLowerCase());
    
    // Mapeamento flexível de colunas
    const findColIndex = (candidates) => {
      return headers.findIndex(h => candidates.some(c => h.includes(c)));
    };

    const idxCodigo = findColIndex(['codigo', 'código', 'cod']);
    const idxProc = findColIndex(['procedimento', 'descricao', 'descrição', 'nome']);
    const idxPorte = findColIndex(['porte', 'porte_medico']);
    const idxUco = findColIndex(['uco', 'unidade_custo']);
    const idxAnest = findColIndex(['anestesia', 'porte_anest']);
    const idxFilme = findColIndex(['filme', 'chapa']);
    const idxGrupo = findColIndex(['grupo', 'categoria']);

    const procedures = [];

    for (let i = 1; i < lines.length; i++) {
      const row = lines[i].split(separator).map(cell => cell.trim().replace(/^"(.*)"$/, '$1'));
      if (row.length === 0 || !row[0]) continue;

      const codigo = idxCodigo !== -1 ? row[idxCodigo] : row[0];
      const procedimento = idxProc !== -1 ? row[idxProc] : row[1] || 'Sem Descrição';
      const porte = idxPorte !== -1 ? row[idxPorte] : row[2] || '1A';
      const uco = idxUco !== -1 ? parseFloat(row[idxUco]) || 0 : 0;
      const anestesia = idxAnest !== -1 ? row[idxAnest] : '0';
      const filme = idxFilme !== -1 ? parseFloat(row[idxFilme]) || 0 : 0;
      const grupo = idxGrupo !== -1 ? row[idxGrupo] : 'Importados';

      if (codigo && procedimento) {
        procedures.push({
          codigo,
          procedimento,
          grupo,
          subgrupo: 'Importado',
          porte,
          anestesia,
          incidencia: '1',
          uco,
          filme,
          versao: defaultVersionNome,
          observacao: 'Carregado via importação de arquivo.'
        });
      }
    }

    return procedures;
  }

  /**
   * Lê um arquivo enviado via File Input no browser
   * @param {File} file Arquivo selecionado pelo usuário
   * @param {string} versionName Nome da versão da tabela
   */
  static readFile(file, versionName = 'Tabela Personalizada') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const content = e.target.result;
          if (file.name.endsWith('.json')) {
            const data = JSON.parse(content);
            resolve(Array.isArray(data) ? data : []);
          } else {
            const parsed = CBHPMDataLoader.parseCSV(content, versionName);
            resolve(parsed);
          }
        } catch (err) {
          reject(err);
        }
      };

      reader.onerror = (err) => reject(err);
      reader.readAsText(file);
    });
  }
}
