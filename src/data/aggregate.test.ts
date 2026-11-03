import { describe, expect, it } from 'vitest';
import { buildDataset } from './generate';
import {
  METRICS, PERIODS, auc, bucketValues, computeKpis, confusion, getRange, groupBuckets, inRange, rocCurve, psi,
} from './aggregate';
import { SEGMENTS } from './types';

const { records } = buildDataset();

describe('base sintética', () => {
  it('tem pelo menos 10.000 registros e é reprodutível (semente fixa)', () => {
    expect(records.length).toBeGreaterThanOrEqual(10000);
    const again = buildDataset().records;
    expect(again[123]).toEqual(records[123]);
    expect(again[records.length - 1]).toEqual(records[records.length - 1]);
  });

  it('taxas plausíveis', () => {
    const k = computeKpis(records);
    console.log('KPIs globais', { churn: k.churn, auc: k.auc, prec: k.precision, rec: k.recall, conv: k.conversion, ticket: k.ticket });
    expect(k.churn).toBeGreaterThan(5);
    expect(k.churn).toBeLessThan(35);
    expect(k.auc).toBeGreaterThan(0.7);
    expect(k.auc).toBeLessThan(0.99);
    expect(k.conversion).toBeGreaterThan(2);
  });
});

describe('consistência entre agregações', () => {
  it('soma dos buckets = total do período, para todos os períodos', () => {
    for (const p of PERIODS) {
      const range = getRange(p.key);
      const cur = inRange(records, range);
      const buckets = groupBuckets(cur, range, p.buckets);
      expect(buckets.reduce((a, b) => a + b.length, 0)).toBe(cur.length);
      const rev = bucketValues(buckets, METRICS.revenue.agg).reduce((a: number, b) => a + (b ?? 0), 0);
      expect(rev).toBeCloseTo(computeKpis(cur).revenue, 4);
    }
  });

  it('segmentos particionam o total', () => {
    const cur = inRange(records, getRange('12m'));
    const total = computeKpis(cur).revenue;
    const parts = SEGMENTS.map((s) => computeKpis(cur.filter((r) => r.segment === s)).revenue);
    expect(parts.reduce((a, b) => a + b, 0)).toBeCloseTo(total, 4);
  });

  it('períodos curtos são subconjuntos dos longos; período anterior não se sobrepõe', () => {
    const n = (k: '7d' | '30d' | '90d' | '12m') => inRange(records, getRange(k)).length;
    expect(n('7d')).toBeLessThan(n('30d'));
    expect(n('30d')).toBeLessThan(n('90d'));
    expect(n('90d')).toBeLessThan(n('12m'));
    const a = getRange('30d');
    const b = getRange('30d', true);
    expect(b.end).toBe(a.start - 1);
  });

  it('funil é monotônico e ticket = receita / transações', () => {
    const k = computeKpis(inRange(records, getRange('12m')));
    for (let i = 1; i < k.funnel.length; i++) expect(k.funnel[i]).toBeLessThanOrEqual(k.funnel[i - 1]);
    expect(k.funnel[0]).toBe(k.n);
    expect(k.ticket).toBeCloseTo(k.revenue / k.transactions, 6);
    expect(k.retention).toBeCloseTo(100 - k.churn, 6);
  });
});

describe('machine learning', () => {
  const cur = inRange(records, getRange('12m'));
  it('matriz de confusão soma N e métricas coerentes com limiar', () => {
    const cm = confusion(cur, 0, 0.5);
    expect(cm.tp + cm.fp + cm.tn + cm.fn).toBe(cur.length);
    const lo = confusion(cur, 0, 0.1);
    expect(lo.tp).toBeGreaterThanOrEqual(cm.tp); // limiar menor => recall maior
  });
  it('AUC por postos ≈ AUC por integração da curva ROC', () => {
    const roc = rocCurve(cur, 0, 100000);
    let area = 0;
    for (let i = 1; i < roc.length; i++) area += ((roc[i][0] - roc[i - 1][0]) * (roc[i][1] + roc[i - 1][1])) / 2;
    expect(area).toBeCloseTo(auc(cur, 0), 3);
  });
  it('modelos melhores têm AUC maior', () => {
    expect(auc(cur, 0)).toBeGreaterThan(auc(cur, 4));
  });
  it('PSI: ~0 para a mesma distribuição e >0,25 sob drift', () => {
    const early = records.filter((r) => r.d < 90).map((r) => r.scores[0]);
    expect(psi(early, early)).toBeCloseTo(0, 6);
    const late = records.filter((r) => r.d >= 665).map((r) => r.scores[0]);
    console.log('PSI drift', psi(early, late));
    expect(psi(early, late)!).toBeGreaterThan(0.1);
  });
});
