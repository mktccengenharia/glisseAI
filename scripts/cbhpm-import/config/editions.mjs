// Mapeamento edição de procedimentos -> fonte de valores de porte, confirmado
// manualmente contra os PDFs em C:\Users\carme\OneDrive\Documentos\JOHN\tabelas_cbhpm\tabelas_cbhpm.
// A edição 2018 não está aqui: já foi importada antes e é corrigida à parte
// por 07-fix-2018-porte.mjs (troca de vigência de valores, não reprocessamento
// do parser de procedimentos).

export const SOURCE_DIR = 'C:\\Users\\carme\\OneDrive\\Documentos\\JOHN\\tabelas_cbhpm\\tabelas_cbhpm'

// 3ª a 2016 usam 30/20/20/20; só a 2018 usa 60/40/30/30 (confirmado lendo a
// seção "5. AUXILIARES DE CIRURGIA" de cada PDF).
const AUX_PCT_ANTIGO = [0.3, 0.2, 0.2, 0.2]

export const EDITIONS = [
  {
    id: '3ed',
    versaoLabel: 'CBHPM 3ª edição',
    sourcePdf: 'CBHPM 3ª EDIÇÃO.pdf',
    auxPct: AUX_PCT_ANTIGO,
    vigencia: '2003',
    porteSource: { type: 'embedded', file: 'CBHPM 3ª EDIÇÃO.pdf' },
  },
  {
    id: '2008',
    versaoLabel: 'CBHPM 2008',
    sourcePdf: 'cbhpm 2008.pdf',
    auxPct: AUX_PCT_ANTIGO,
    vigencia: '2008',
    porteSource: { type: 'file', file: 'porte 2008.pdf' },
  },
  {
    id: '2010',
    versaoLabel: 'CBHPM 2010',
    sourcePdf: 'CBHPM 2010.pdf',
    auxPct: AUX_PCT_ANTIGO,
    vigencia: '2010',
    porteSource: { type: 'file-column', file: 'PORTES CBHPM.pdf', column: 1 },
  },
  {
    id: '2014',
    versaoLabel: 'CBHPM 2014',
    sourcePdf: 'CBHPM 2014.pdf',
    auxPct: AUX_PCT_ANTIGO,
    vigencia: '2014',
    porteSource: { type: 'file-column', file: 'PORTES CBHPM.pdf', column: 3 },
  },
  {
    id: '2015',
    versaoLabel: 'CBHPM 2015',
    sourcePdf: 'CBHPM 2015.pdf',
    auxPct: AUX_PCT_ANTIGO,
    vigencia: '2015-2016',
    porteSource: { type: 'file', file: 'porte 2015-2016.pdf' },
  },
  {
    id: '2016',
    versaoLabel: 'CBHPM 2016',
    sourcePdf: 'CBHPM 2016.pdf',
    auxPct: AUX_PCT_ANTIGO,
    vigencia: '2015-2016',
    porteSource: { type: 'file', file: 'porte 2015-2016.pdf' },
  },
  {
    // 2026-08-19: adicionada a pedido do usuário, fonte fornecida diretamente
    // (tabela_cbhpm_edicao_2012.pdf + tabela_de_portes_uco.pdf, Comunicado
    // Oficial CBHPM de 18/10/2012, UCO = R$ 14,33). AuxPct confirmado lendo o
    // próprio PDF, Instruções Gerais item 5.1: "30% ... primeiro auxiliar,
    // 20% para o segundo e terceiro ... também para o quarto" — igual às
    // edições 3ª a 2016 (formato de tabela idêntico: Código/Procedimentos/
    // Porte/Custo Oper./Nº Aux./Porte Anest. no Cap. 3).
    id: '2012',
    versaoLabel: 'CBHPM 2012',
    sourcePdf: 'CBHPM 2012.pdf',
    auxPct: AUX_PCT_ANTIGO,
    vigencia: '2012',
    porteSource: { type: 'file', file: 'Porte CBHPM 2012.pdf' },
  },
]
