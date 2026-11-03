export const SEGMENTS = ['Enterprise', 'Mid-Market', 'SMB', 'Startup'] as const;
export const REGIONS = ['Sudeste', 'Sul', 'Nordeste', 'Centro-Oeste', 'Norte'] as const;
export type Segment = (typeof SEGMENTS)[number];
export type Region = (typeof REGIONS)[number];

export const MODELS = ['XGBoost', 'LightGBM', 'Random Forest', 'Rede Neural (MLP)', 'Regressão Logística'] as const;

/** Um registro = atividade diária (sintética) de um cliente. */
export interface DataRecord {
  id: number;
  /** índice do dia (0 = mais antigo, TOTAL_DAYS-1 = hoje) */
  d: number;
  date: string; // ISO yyyy-mm-dd
  customerId: string;
  segment: Segment;
  region: Region;
  revenue: number;
  transactions: number;
  engagement: number; // 0-100
  tenure: number; // meses
  latency: number; // ms da predição
  churn: 0 | 1; // churn real
  convProb: number; // probabilidade de conversão (0-1)
  /** 0 = registro, 1 = engajado, 2 = qualificado, 3 = proposta, 4 = convertido */
  stage: 0 | 1 | 2 | 3 | 4;
  /** score de churn por modelo (índice = MODELS); [0] é o modelo principal */
  scores: number[];
  isFirst: boolean; // primeiro registro do cliente na base
}
