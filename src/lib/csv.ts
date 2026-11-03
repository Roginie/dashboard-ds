import { DataRecord } from '../data/types';

const esc = (v: string | number) => {
  const s = String(v);
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function recordsToCsv(rs: DataRecord[], thr: number) {
  const head = [
    'id', 'data', 'id_cliente', 'segmento', 'regiao', 'receita', 'transacoes', 'engajamento', 'tempo_casa_meses',
    'latencia_ms', 'churn_real', 'prob_conversao', 'etapa_funil', 'score_churn_xgboost', `predicao_churn_limiar_${thr}`,
  ];
  const lines = rs.map((r) =>
    [
      r.id, r.date, r.customerId, r.segment, r.region, r.revenue, r.transactions, r.engagement, r.tenure,
      r.latency, r.churn, r.convProb, r.stage, r.scores[0], r.scores[0] >= thr ? 1 : 0,
    ].map(esc).join(','),
  );
  return '﻿' + [head.join(','), ...lines].join('\n');
}

export function downloadCsv(rs: DataRecord[], thr: number, name = 'dados_sinteticos') {
  const blob = new Blob([recordsToCsv(rs, thr)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
