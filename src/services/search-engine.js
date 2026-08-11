import { INITIAL_CBHPM_DATA, DEFAULT_TABLE_CONFIG, CBHPM_VERSIONS } from '../data/cbhpm-schema.js';

export class CBHPMSearchEngine {
  constructor(customData = null, config = DEFAULT_TABLE_CONFIG) {
    this.procedures = customData || [...INITIAL_CBHPM_DATA];
    this.config = { ...DEFAULT_TABLE_CONFIG, ...config };
  }

  /**
   * Atualiza a base de procedimentos (ex: após importação de CSV/Excel)
   */
  setProcedures(procedures) {
    if (Array.isArray(procedures)) {
      this.procedures = procedures;
    }
  }

  /**
   * Adiciona novos procedimentos à base existente
   */
  addProcedures(newProcedures) {
    if (Array.isArray(newProcedures)) {
      this.procedures.push(...newProcedures);
    }
  }

  /**
   * Atualiza as configurações de cálculo de UCO e Portes em R$
   */
  updateConfig(newConfig) {
    this.config = {
      ...this.config,
      ...newConfig,
      porteValues: { ...this.config.porteValues, ...(newConfig.porteValues || {}) }
    };
  }

  /**
   * Normaliza um código numérico removendo pontos, traços e espaços
   */
  normalizeCode(codeStr) {
    if (!codeStr) return '';
    return String(codeStr).replace(/[^0-9]/g, '');
  }

  /**
   * Calcula o valor em Reais (R$) do porte do procedimento
   */
  calculatePorteValue(porte) {
    if (!porte) return 0;
    const cleanPorte = String(porte).trim().toUpperCase();
    return this.config.porteValues[cleanPorte] || 0;
  }

  /**
   * Calcula o valor total em Reais (R$) da UCO do procedimento
   */
  calculateUcoValue(ucoAmount) {
    const amount = parseFloat(ucoAmount) || 0;
    return amount * (this.config.ucoValue || 0);
  }

  /**
   * Retorna os detalhes completos enriquecidos com valores em Reais (R$)
   */
  enrichProcedureDetails(item) {
    const valorPorte = this.calculatePorteValue(item.porte);
    const valorUco = this.calculateUcoValue(item.uco);
    const valorTotalEstimado = valorPorte + valorUco;

    return {
      ...item,
      valorPorteR$: valorPorte,
      valorUcoR$: valorUco,
      valorTotalR$: valorTotalEstimado,
      valorUcoUnitarioR$: this.config.ucoValue
    };
  }

  /**
   * Busca principal híbrida (Código exato ou Busca textual/semântica)
   * @param {string} query Termo de busca (Código ou palavra-chave)
   * @param {string} [versionFilter] Versão da tabela CBHPM para filtrar (opcional)
   */
  search(query, versionFilter = 'ALL') {
    if (!query || typeof query !== 'string') return [];

    const trimmedQuery = query.trim();
    if (!trimmedQuery) return [];

    let dataset = this.procedures;
    if (versionFilter && versionFilter !== 'ALL') {
      dataset = dataset.filter(item => item.versao === versionFilter);
    }

    const cleanQueryCode = this.normalizeCode(trimmedQuery);
    const isNumericSearch = cleanQueryCode.length >= 3 && /^[0-9.-]+$/.test(trimmedQuery);

    if (isNumericSearch) {
      // Prioridade 1: Match por código limpo
      const matchByCode = dataset.filter(item => {
        const itemCleanCode = this.normalizeCode(item.codigo);
        return itemCleanCode.includes(cleanQueryCode);
      });

      if (matchByCode.length > 0) {
        return matchByCode.map(item => this.enrichProcedureDetails(item));
      }
    }

    // Prioridade 2: Busca por texto / palavra-chave na descrição ou subgrupo
    const searchTerms = trimmedQuery
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .split(/\s+/)
      .filter(t => t.length > 1);

    const matches = dataset.map(item => {
      const normalizedProc = (item.procedimento || '')
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

      const normalizedGrupo = ((item.grupo || '') + ' ' + (item.subgrupo || ''))
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

      let score = 0;
      searchTerms.forEach(term => {
        if (normalizedProc.includes(term)) {
          score += 10;
          if (normalizedProc.startsWith(term)) score += 5;
        } else if (normalizedGrupo.includes(term)) {
          score += 3;
        }
      });

      return { item, score };
    })
    .filter(res => res.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(res => this.enrichProcedureDetails(res.item));

    return matches;
  }

  /**
   * Obtém a lista de todas as versões de tabela disponíveis
   */
  getAvailableVersions() {
    const versions = new Set(this.procedures.map(p => p.versao).filter(Boolean));
    return Array.from(versions);
  }
}
