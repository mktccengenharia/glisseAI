/**
 * Esquema de Dados e Dados Iniciais para Tabelas CBHPM (Classificação Brasileira Hierarquizada de Procedimentos Médicos)
 */

export const CBHPM_VERSIONS = {
  NATIONAL_2024: "CBHPM Nacional 2024",
  NATIONAL_2020: "CBHPM Nacional 2020",
  CONVENIO_PREMIUM: "CBHPM Personalizada - Convênio Premium",
};

// Tabela de referência padrão de UCO e Portes (Valores de referência em R$)
export const DEFAULT_TABLE_CONFIG = {
  ucoValue: 12.50, // Valor de 1 UCO em R$
  porteValues: {
    "1A": 22.00,
    "1B": 44.00,
    "1C": 66.00,
    "2A": 110.00,
    "2B": 154.00,
    "2C": 210.00,
    "3A": 290.00,
    "3B": 380.00,
    "3C": 480.00,
    "4A": 590.00,
    "4B": 710.00,
    "4C": 850.00,
    "5A": 990.00,
    "5B": 1150.00,
    "5C": 1320.00,
    "6A": 1500.00,
    "6B": 1710.00,
    "6C": 1950.00,
    "7A": 2200.00,
    "7B": 2480.00,
    "7C": 2790.00,
    "8A": 3120.00,
    "8B": 3480.00,
    "8C": 3870.00,
    "9A": 4290.00,
    "9B": 4740.00,
    "9C": 5220.00,
    "10A": 5740.00,
    "10B": 6300.00,
    "10C": 6900.00,
    "11A": 7550.00,
    "11B": 8250.00,
    "11C": 9000.00,
    "12A": 9800.00,
    "12B": 10650.00,
    "12C": 11550.00,
    "13A": 12500.00,
    "13B": 13500.00,
    "13C": 14600.00,
    "14A": 15800.00
  }
};

/**
 * Procedimentos demonstrativos padrão da CBHPM
 */
export const INITIAL_CBHPM_DATA = [
  {
    codigo: "1.01.01.01-2",
    procedimento: "Em consultório (no horário normal ou extraordinário)",
    grupo: "Consultas Médicas",
    subgrupo: "Em Consultório",
    porte: "2B",
    anestesia: "0",
    incidencia: "1",
    uco: 0.00,
    filme: 0.00,
    versao: CBHPM_VERSIONS.NATIONAL_2024,
    observacao: "Consulta médica ambulatorial padrão."
  },
  {
    codigo: "1.01.01.02-0",
    procedimento: "Em domicílio",
    grupo: "Consultas Médicas",
    subgrupo: "Em Domicílio",
    porte: "3A",
    anestesia: "0",
    incidencia: "1",
    uco: 0.00,
    filme: 0.00,
    versao: CBHPM_VERSIONS.NATIONAL_2024,
    observacao: "Atendimento médico no domicílio do paciente."
  },
  {
    codigo: "1.01.01.03-9",
    procedimento: "Em pronto socorro",
    grupo: "Consultas Médicas",
    subgrupo: "Urgência / Emergência",
    porte: "2B",
    anestesia: "0",
    incidencia: "1",
    uco: 0.00,
    filme: 0.00,
    versao: CBHPM_VERSIONS.NATIONAL_2024,
    observacao: "Atendimento médico em unidade de pronto atendimento."
  },
  {
    codigo: "4.01.01.01-0",
    procedimento: "ECG convencional de 12 derivações",
    grupo: "Métodos Diagnósticos",
    subgrupo: "Eletrocardiografia",
    porte: "1B",
    anestesia: "0",
    incidencia: "1",
    uco: 2.50,
    filme: 0.00,
    versao: CBHPM_VERSIONS.NATIONAL_2024,
    observacao: "Exame gráfico da atividade elétrica do coração."
  },
  {
    codigo: "4.08.08.04-1",
    procedimento: "Radiografia de tórax - 2 incidências (PA e perfil)",
    grupo: "Radiologia e Diagnóstico por Imagem",
    subgrupo: "Radiografia Geral",
    porte: "1C",
    anestesia: "0",
    incidencia: "2",
    uco: 5.20,
    filme: 0.45,
    versao: CBHPM_VERSIONS.NATIONAL_2024,
    observacao: "Requer filme radiológico m² 0,45."
  },
  {
    codigo: "4.09.01.12-2",
    procedimento: "Ultrassonografia abdominal total",
    grupo: "Ultrassonografia",
    subgrupo: "Abdômen",
    porte: "3B",
    anestesia: "0",
    incidencia: "1",
    uco: 12.00,
    filme: 0.00,
    versao: CBHPM_VERSIONS.NATIONAL_2024,
    observacao: "Inclui fígado, vias biliares, pâncreas, baço, rins e bexiga."
  },
  {
    codigo: "3.01.01.00-7",
    procedimento: "Biópsia de pele e tecido celular subcutâneo",
    grupo: "Procedimentos Cirúrgicos e Invasivos",
    subgrupo: "Pele e Anexos",
    porte: "3C",
    anestesia: "1",
    incidencia: "1",
    uco: 4.50,
    filme: 0.00,
    versao: CBHPM_VERSIONS.NATIONAL_2024,
    observacao: "Excisão de fragmento para análise histopatológica."
  },
  {
    codigo: "3.10.02.01-0",
    procedimento: "Ressecção endoscópica da próstata (RTU de próstata)",
    grupo: "Procedimentos Cirúrgicos e Invasivos",
    subgrupo: "Sistema Urogenital",
    porte: "9A",
    anestesia: "4",
    incidencia: "1",
    uco: 45.00,
    filme: 0.00,
    versao: CBHPM_VERSIONS.NATIONAL_2024,
    observacao: "Exige anestesia porte 4. Procedimento hospitalar."
  },
  {
    codigo: "3.09.01.04-6",
    procedimento: "Catarata com implante de lente intraocular (Facoemulsificação)",
    grupo: "Procedimentos Cirúrgicos e Invasivos",
    subgrupo: "Olho e Anexos",
    porte: "8C",
    anestesia: "3",
    incidencia: "1",
    uco: 38.00,
    filme: 0.00,
    versao: CBHPM_VERSIONS.NATIONAL_2024,
    observacao: "Cirurgia oftalmológica avançada."
  },
  {
    codigo: "3.03.01.04-0",
    procedimento: "Apendicectomia por videolaparoscopia",
    grupo: "Procedimentos Cirúrgicos e Invasivos",
    subgrupo: "Aparelho Digestivo",
    porte: "10A",
    anestesia: "5",
    incidencia: "1",
    uco: 65.00,
    filme: 0.00,
    versao: CBHPM_VERSIONS.NATIONAL_2024,
    observacao: "Ressecção de apêndice cecal via laparoscópica."
  },
  {
    codigo: "4.10.01.08-0",
    procedimento: "Ressonância magnética de encéfalo",
    grupo: "Ressonância Magnética",
    subgrupo: "Crânio e Encéfalo",
    porte: "6B",
    anestesia: "0",
    incidencia: "1",
    uco: 78.00,
    filme: 0.00,
    versao: CBHPM_VERSIONS.NATIONAL_2024,
    observacao: "Sem ou com contraste gadolínio (conforme indicação)."
  },
  {
    codigo: "4.11.01.01-0",
    procedimento: "Tomografia computadorizada de tórax",
    grupo: "Tomografia Computadorizada",
    subgrupo: "Tórax",
    porte: "5A",
    anestesia: "0",
    incidencia: "1",
    uco: 42.00,
    filme: 0.00,
    versao: CBHPM_VERSIONS.NATIONAL_2024,
    observacao: "Avaliação parenquimatosa e mediastinal."
  }
];
