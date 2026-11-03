import { DataRecord } from './types';
import { TOTAL_DAYS, dayToDate } from './generate';
import { brl, brlShort, compact, int, ms, num1, num2, pct } from '../lib/format';

/* ───────────── Períodos e buckets ───────────── */
export type PeriodKey = '7d' | '30d' | '90d' | '12m';
export const PERIODS: { key: PeriodKey; label: string; days: number; buckets: number }[] = [
  { key: '7d', label: '7 dias', days: 7, buckets: 7 },
  { key: '30d', label: '30 dias', days: 30, buckets: 30 },
  { key: '90d', label: '90 dias', days: 90, buckets: 15 },
  { key: '12m', label: '12 meses', days: 365, buckets: 12 },
];
export const periodDef = (k: PeriodKey) => PERIODS.find((p) => p.key === k)!;

export interface Range {
  start: number;
  end: number;
}
export function getRange(k: PeriodKey, prev = false): Range {
  const p = periodDef(k);
  const end = TOTAL_DAYS - 1 - (prev ? p.days : 0);
  return { start: end - p.days + 1, end };
}
export const inRange = (rs: DataRecord[], r: Range) => rs.filter((x) => x.d >= r.start && x.d <= r.end);

export function groupBuckets(rs: DataRecord[], range: Range, count: number): DataRecord[][] {
  const len = range.end - range.start + 1;
  const out: DataRecord[][] = Array.from({ length: count }, () => []);
  for (const r of rs) {
    if (r.d < range.start || r.d > range.end) continue;
    out[Math.min(count - 1, Math.floor(((r.d - range.start) * count) / len))].push(r);
  }
  return out;
}

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const pad = (n: number) => String(n).padStart(2, '0');
export function bucketLabels(range: Range, count: number): string[] {
  const len = range.end - range.start + 1;
  return Array.from({ length: count }, (_, i) => {
    const s = range.start + Math.floor((i * len) / count);
    const e = range.start + Math.floor(((i + 1) * len) / count) - 1;
    if (count === 12) {
      const mid = dayToDate(Math.floor((s + e) / 2));
      return `${MONTHS[mid.getUTCMonth()]}/${String(mid.getUTCFullYear()).slice(2)}`;
    }
    const dt = dayToDate(s);
    return `${pad(dt.getUTCDate())}/${pad(dt.getUTCMonth() + 1)}`;
  });
}

/* ───────────── Estatística básica ───────────── */
export const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
export const mean = (a: number[]) => (a.length ? sum(a) / a.length : 0);
export const std = (a: number[]) => {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(sum(a.map((x) => (x - m) ** 2)) / (a.length - 1));
};
export function quantile(sorted: number[], p: number) {
  if (!sorted.length) return 0;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}
export const sortedCopy = (a: number[]) => [...a].sort((x, y) => x - y);

export function pearson(x: number[], y: number[]) {
  const n = x.length;
  if (n < 3) return 0;
  const mx = mean(x);
  const my = mean(y);
  let sxy = 0,
    sxx = 0,
    syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx;
    const dy = y[i] - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : 0;
}

export function linreg(y: (number | null)[]) {
  const pts = y.map((v, i) => [i, v] as const).filter((p): p is readonly [number, number] => p[1] !== null);
  const n = pts.length;
  if (n < 2) return { slope: 0, intercept: pts[0]?.[1] ?? 0 };
  const mx = mean(pts.map((p) => p[0]));
  const my = mean(pts.map((p) => p[1]));
  let sxy = 0,
    sxx = 0;
  for (const [x, v] of pts) {
    sxy += (x - mx) * (v - my);
    sxx += (x - mx) ** 2;
  }
  const slope = sxx ? sxy / sxx : 0;
  return { slope, intercept: my - slope * mx };
}

export function histogram(values: number[], maxBins = 30) {
  if (!values.length) return { centers: [] as number[], counts: [] as number[], width: 0, min: 0 };
  const bins = Math.max(5, Math.min(maxBins, Math.ceil(Math.log2(values.length)) + 1));
  let min = Infinity,
    max = -Infinity;
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (min === max) max = min + 1;
  const width = (max - min) / bins;
  const counts = new Array(bins).fill(0);
  for (const v of values) counts[Math.min(bins - 1, Math.floor((v - min) / width))]++;
  const centers = counts.map((_, i) => min + width * (i + 0.5));
  return { centers, counts, width, min };
}

export function boxStats(values: number[]) {
  const s = sortedCopy(values);
  if (!s.length) return null;
  const q1 = quantile(s, 0.25);
  const med = quantile(s, 0.5);
  const q3 = quantile(s, 0.75);
  const iqr = q3 - q1;
  const lo = q1 - 1.5 * iqr;
  const hi = q3 + 1.5 * iqr;
  const inside = s.filter((v) => v >= lo && v <= hi);
  const outliers = s.filter((v) => v < lo || v > hi);
  return { low: inside[0], q1, med, q3, high: inside[inside.length - 1], outliers, n: s.length };
}

/** Suavização exponencial de Holt (nível + tendência): previsão 1 passo à frente. */
export function holt(y: (number | null)[], h = 2, alpha = 0.5, beta = 0.2) {
  const v = y.map((x) => x ?? 0);
  const fitted: number[] = [];
  let level = v[0] ?? 0;
  let trend = v.length > 1 ? v[1] - v[0] : 0;
  fitted.push(level);
  for (let i = 1; i < v.length; i++) {
    fitted.push(level + trend);
    const prevLevel = level;
    level = alpha * v[i] + (1 - alpha) * (level + trend);
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
  }
  const future = Array.from({ length: h }, (_, k) => level + trend * (k + 1));
  const res = v.slice(1).map((x, i) => x - fitted[i + 1]);
  return { fitted, future, sigma: std(res) };
}

/* ───────────── Métricas por registro ───────────── */
export type MetricKey = 'revenue' | 'transactions' | 'clients' | 'engagement' | 'churn' | 'conversion' | 'latency';
export interface MetricDef {
  key: MetricKey;
  label: string;
  kind: 'sum' | 'avg';
  agg: (rs: DataRecord[]) => number;
  fmt: (v: number) => string;
  short: (v: number) => string;
}
export const METRICS: Record<MetricKey, MetricDef> = {
  revenue: { key: 'revenue', label: 'Receita', kind: 'sum', agg: (rs) => sum(rs.map((r) => r.revenue)), fmt: brl, short: brlShort },
  transactions: { key: 'transactions', label: 'Transações', kind: 'sum', agg: (rs) => sum(rs.map((r) => r.transactions)), fmt: int, short: compact },
  clients: { key: 'clients', label: 'Clientes ativos', kind: 'sum', agg: (rs) => new Set(rs.map((r) => r.customerId)).size, fmt: int, short: compact },
  engagement: { key: 'engagement', label: 'Engajamento médio', kind: 'avg', agg: (rs) => mean(rs.map((r) => r.engagement)), fmt: num1, short: num1 },
  churn: { key: 'churn', label: 'Taxa de churn (%)', kind: 'avg', agg: (rs) => (mean(rs.map((r) => r.churn)) * 100), fmt: (v) => pct(v), short: (v) => pct(v, 0) },
  conversion: { key: 'conversion', label: 'Taxa de conversão (%)', kind: 'avg', agg: (rs) => (rs.filter((r) => r.stage === 4).length / (rs.length || 1)) * 100, fmt: (v) => pct(v), short: (v) => pct(v, 0) },
  latency: { key: 'latency', label: 'Latência média (ms)', kind: 'avg', agg: (rs) => mean(rs.map((r) => r.latency)), fmt: ms, short: (v) => num1(v) },
};

/** Valor da função por bucket; buckets vazios => 0 (somas) ou null (médias). */
export function bucketValues(buckets: DataRecord[][], fn: (rs: DataRecord[]) => number, kind: 'sum' | 'avg' = 'sum') {
  return buckets.map((b) => (b.length ? fn(b) : kind === 'sum' ? 0 : null));
}

/* ───────────── Variáveis de análise ───────────── */
export type VarKey = 'revenue' | 'transactions' | 'engagement' | 'tenure' | 'latency' | 'convProb' | 'churn' | 'churnScore';
export const VARIABLES: { key: VarKey; label: string; get: (r: DataRecord) => number; fmt: (v: number) => string }[] = [
  { key: 'revenue', label: 'Receita (R$)', get: (r) => r.revenue, fmt: brl },
  { key: 'transactions', label: 'Transações', get: (r) => r.transactions, fmt: int },
  { key: 'engagement', label: 'Engajamento', get: (r) => r.engagement, fmt: num1 },
  { key: 'tenure', label: 'Tempo de casa (meses)', get: (r) => r.tenure, fmt: int },
  { key: 'latency', label: 'Latência (ms)', get: (r) => r.latency, fmt: num1 },
  { key: 'convProb', label: 'Prob. conversão', get: (r) => r.convProb, fmt: num2 },
  { key: 'churn', label: 'Churn (real)', get: (r) => r.churn, fmt: int },
  { key: 'churnScore', label: 'Score de churn (ML)', get: (r) => r.scores[0], fmt: num2 },
];
export const varDef = (k: VarKey) => VARIABLES.find((v) => v.key === k)!;

/* ───────────── Machine Learning ───────────── */
export function confusion(rs: DataRecord[], model: number, thr: number) {
  let tp = 0,
    fp = 0,
    tn = 0,
    fn = 0;
  for (const r of rs) {
    const pred = r.scores[model] >= thr;
    if (r.churn === 1) pred ? tp++ : fn++;
    else pred ? fp++ : tn++;
  }
  return { tp, fp, tn, fn };
}
export function classMetrics(cm: { tp: number; fp: number; tn: number; fn: number }) {
  const { tp, fp, tn, fn } = cm;
  const precision = tp + fp ? tp / (tp + fp) : 0;
  const recall = tp + fn ? tp / (tp + fn) : 0;
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
  const n = tp + fp + tn + fn;
  return { precision, recall, f1, accuracy: n ? (tp + tn) / n : 0 };
}

/** AUC por soma de postos (Mann–Whitney), com tratamento de empates. */
export function auc(rs: DataRecord[], model: number) {
  const n = rs.length;
  const idx = rs.map((_, i) => i).sort((a, b) => rs[a].scores[model] - rs[b].scores[model]);
  let rankSumPos = 0;
  let P = 0;
  let i = 0;
  while (i < n) {
    let j = i;
    while (j + 1 < n && rs[idx[j + 1]].scores[model] === rs[idx[i]].scores[model]) j++;
    const avgRank = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) if (rs[idx[k]].churn === 1) (rankSumPos += avgRank), P++;
    i = j + 1;
  }
  const N = n - P;
  return P && N ? (rankSumPos - (P * (P + 1)) / 2) / (P * N) : 0.5;
}

export function rocCurve(rs: DataRecord[], model: number, maxPts = 120): [number, number][] {
  const sorted = [...rs].sort((a, b) => b.scores[model] - a.scores[model]);
  const P = sorted.filter((r) => r.churn === 1).length;
  const N = sorted.length - P;
  if (!P || !N) return [[0, 0], [1, 1]];
  const pts: [number, number][] = [[0, 0]];
  let tp = 0,
    fp = 0;
  for (let i = 0; i < sorted.length; i++) {
    sorted[i].churn === 1 ? tp++ : fp++;
    if (i === sorted.length - 1 || sorted[i + 1].scores[model] !== sorted[i].scores[model]) pts.push([fp / N, tp / P]);
  }
  if (pts.length <= maxPts) return pts;
  const step = pts.length / maxPts;
  const out: [number, number][] = [];
  for (let k = 0; k < maxPts; k++) out.push(pts[Math.floor(k * step)]);
  out.push(pts[pts.length - 1]);
  return out;
}

export function psi(base: number[], cur: number[]) {
  if (base.length < 20 || cur.length < 20) return null;
  const s = sortedCopy(base);
  const edges: number[] = [];
  for (let q = 1; q < 10; q++) {
    const e = quantile(s, q / 10);
    if (!edges.length || e > edges[edges.length - 1]) edges.push(e);
  }
  const bin = (v: number) => {
    let i = 0;
    while (i < edges.length && v > edges[i]) i++;
    return i;
  };
  const cnt = (a: number[]) => {
    const c = new Array(edges.length + 1).fill(0);
    a.forEach((v) => c[bin(v)]++);
    return c.map((x) => Math.max(x / a.length, 1e-4));
  };
  const e = cnt(base);
  const a = cnt(cur);
  return sum(e.map((ei, i) => (a[i] - ei) * Math.log(a[i] / ei)));
}

/** PSI do score por bucket (janela móvel de 7 dias para granularidade diária). */
export function driftSeries(dim: DataRecord[], range: Range, count: number) {
  const base = dim.filter((r) => r.d < 90).map((r) => r.scores[0]);
  const len = range.end - range.start + 1;
  const pool = dim.filter((r) => r.d >= range.start - 6 && r.d <= range.end);
  return Array.from({ length: count }, (_, i) => {
    let s = range.start + Math.floor((i * len) / count);
    const e = range.start + Math.floor(((i + 1) * len) / count) - 1;
    if (e - s + 1 < 7) s = e - 6;
    const win = pool.filter((r) => r.d >= s && r.d <= e).map((r) => r.scores[0]);
    return psi(base, win);
  });
}

export const FEATURES: { key: string; label: string; get: (r: DataRecord) => number }[] = [
  { key: 'engagement', label: 'Engajamento', get: (r) => r.engagement },
  { key: 'tenure', label: 'Tempo de casa', get: (r) => r.tenure },
  { key: 'latency', label: 'Latência', get: (r) => r.latency },
  { key: 'convProb', label: 'Prob. conversão', get: (r) => r.convProb },
  { key: 'transactions', label: 'Transações', get: (r) => r.transactions },
  { key: 'revenue', label: 'Receita', get: (r) => r.revenue },
];
/** Importância = |correlação com churn| normalizada para somar 100%. */
export function featureImportance(rs: DataRecord[]) {
  const y = rs.map((r) => r.churn);
  const raw = FEATURES.map((f) => ({ label: f.label, v: Math.abs(pearson(rs.map(f.get), y)) }));
  const tot = sum(raw.map((r) => r.v)) || 1;
  return raw.map((r) => ({ label: r.label, value: (r.v / tot) * 100 })).sort((a, b) => b.value - a.value);
}

/* ───────────── KPIs ───────────── */
export interface Kpis {
  n: number;
  revenue: number;
  transactions: number;
  ticket: number;
  clients: number;
  churn: number; // %
  retention: number; // %
  conversion: number; // %
  precision: number; // %
  recall: number; // %
  f1: number; // %
  accuracy: number; // %
  auc: number;
  latencyAvg: number;
  latencyP95: number;
  predictions: number;
  funnel: number[];
}
export function computeKpis(rs: DataRecord[], thr = 0.5): Kpis {
  const n = rs.length;
  const revenue = sum(rs.map((r) => r.revenue));
  const transactions = sum(rs.map((r) => r.transactions));
  const churn = n ? (rs.filter((r) => r.churn === 1).length / n) * 100 : 0;
  const cm = classMetrics(confusion(rs, 0, thr));
  const lat = sortedCopy(rs.map((r) => r.latency));
  return {
    n,
    revenue,
    transactions,
    ticket: transactions ? revenue / transactions : 0,
    clients: new Set(rs.map((r) => r.customerId)).size,
    churn,
    retention: n ? 100 - churn : 0,
    conversion: n ? (rs.filter((r) => r.stage === 4).length / n) * 100 : 0,
    precision: cm.precision * 100,
    recall: cm.recall * 100,
    f1: cm.f1 * 100,
    accuracy: cm.accuracy * 100,
    auc: n ? auc(rs, 0) : 0,
    latencyAvg: mean(lat),
    latencyP95: quantile(lat, 0.95),
    predictions: n,
    funnel: [0, 1, 2, 3, 4].map((k) => rs.filter((r) => (k === 4 ? r.stage === 4 : r.stage >= k)).length),
  };
}
