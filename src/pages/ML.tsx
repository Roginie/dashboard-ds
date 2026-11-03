import { useMemo, useState } from 'react';
import { Activity, BadgeCheck, Crosshair, Gauge, Target, Zap } from 'lucide-react';
import { PALETTE, SERIES_COLORS, useDash } from '../context/DashboardContext';
import { auc, classMetrics, computeKpis, confusion, driftSeries, featureImportance, rocCurve } from '../data/aggregate';
import { MODELS } from '../data/types';
import { Chart, axisCommon, tip } from '../components/Chart';
import { Card, Empty, KpiCard, Select } from '../components/ui';
import { int, ms, num2, num3, pct } from '../lib/format';
import { usePeriod } from './usePeriod';

type AlgoMetric = 'auc' | 'f1' | 'precision' | 'recall' | 'accuracy';
const ALGO_OPTS: { value: AlgoMetric; label: string }[] = [
  { value: 'auc', label: 'AUC' }, { value: 'f1', label: 'F1-score' }, { value: 'precision', label: 'Precisão' },
  { value: 'recall', label: 'Recall' }, { value: 'accuracy', label: 'Acurácia' },
];

export default function ML() {
  const { cur, prev, dim, ct, threshold, setThreshold } = useDash();
  const { def, range } = usePeriod();
  const [algoMetric, setAlgoMetric] = useState<AlgoMetric>('auc');
  const ax = axisCommon(ct);

  const k = useMemo(() => computeKpis(cur, threshold), [cur, threshold]);
  const pk = useMemo(() => computeKpis(prev, threshold), [prev, threshold]);

  /* 11 ─ Comparação de algoritmos */
  const algos = useMemo(
    () =>
      MODELS.map((name, i) => {
        const m = classMetrics(confusion(cur, i, threshold));
        return { name, auc: auc(cur, i), ...m } as { name: string } & Record<AlgoMetric, number>;
      }).sort((a, b) => a[algoMetric] - b[algoMetric]),
    [cur, threshold, algoMetric],
  );
  const optAlgo = useMemo(() => ({
    grid: { left: 8, right: 56, top: 8, bottom: 4, containLabel: true },
    tooltip: tip(ct, { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: (v: number) => num3(v) }),
    xAxis: { type: 'value', min: (v: { min: number }) => Math.max(0, Math.floor(v.min * 10 - 1) / 10), max: 1, ...ax },
    yAxis: { type: 'category', data: algos.map((a) => a.name), ...ax, splitLine: { show: false } },
    series: [{
      type: 'bar', data: algos.map((a, i) => ({ value: a[algoMetric], itemStyle: { color: i === algos.length - 1 ? PALETTE.green : { type: 'linear', x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: PALETTE.blue }, { offset: 1, color: PALETTE.violet }] }, borderRadius: [0, 6, 6, 0] } })),
      barWidth: 22, label: { show: true, position: 'right', color: ct.text, formatter: (p: { value: number }) => num3(p.value) },
    }],
  }), [algos, algoMetric, ct]);

  /* 12 ─ Matriz de confusão */
  const cm = useMemo(() => confusion(cur, 0, threshold), [cur, threshold]);
  const optCm = useMemo(() => {
    const n = cm.tp + cm.fp + cm.tn + cm.fn || 1;
    const cells = [[0, 0, cm.tn, 'Verdadeiro negativo'], [1, 0, cm.fp, 'Falso positivo'], [0, 1, cm.fn, 'Falso negativo'], [1, 1, cm.tp, 'Verdadeiro positivo']];
    return {
      grid: { left: 8, right: 16, top: 8, bottom: 28, containLabel: true },
      tooltip: tip(ct, { formatter: (p: { value: (string | number)[] }) => `${p.value[3]}<br/><b>${int(p.value[2] as number)}</b> (${pct(((p.value[2] as number) / n) * 100)})` }),
      xAxis: { type: 'category', data: ['Prev.: Retido', 'Prev.: Churn'], position: 'bottom', ...ax, splitLine: { show: false }, axisLabel: { color: ct.text, fontSize: 12 } },
      yAxis: { type: 'category', data: ['Real: Retido', 'Real: Churn'], inverse: true, ...ax, splitLine: { show: false }, axisLabel: { color: ct.text, fontSize: 12 } },
      visualMap: { show: false, dimension: 2, min: 0, max: Math.max(cm.tn, cm.tp, cm.fp, cm.fn, 1), inRange: { color: [ct.mid, PALETTE.violet] }, seriesIndex: 0 },
      series: [{
        type: 'heatmap', data: cells, itemStyle: { borderColor: ct.isDark ? '#0b1020' : '#fff', borderWidth: 4, borderRadius: 8 },
        label: { show: true, fontSize: 15, fontWeight: 700, color: ct.isDark ? '#fff' : '#0f172a', formatter: (p: { value: (string | number)[] }) => `${int(p.value[2] as number)}\n${pct(((p.value[2] as number) / n) * 100)}` },
      }],
    };
  }, [cm, ct]);

  /* 13 ─ ROC / AUC */
  const rocs = useMemo(() => MODELS.map((name, i) => ({ name, auc: auc(cur, i), pts: rocCurve(cur, i) })), [cur]);
  const optRoc = useMemo(() => ({
    grid: { left: 8, right: 16, top: 84, bottom: 24, containLabel: true }, color: SERIES_COLORS,
    legend: { top: 0, textStyle: { color: ct.muted, fontSize: 11 }, itemWidth: 14, itemHeight: 8 },
    tooltip: tip(ct, { trigger: 'item', formatter: (p: { seriesName: string; value: number[] }) => `${p.seriesName}<br/>FPR ${num2(p.value[0])} · TPR <b>${num2(p.value[1])}</b>` }),
    xAxis: { type: 'value', min: 0, max: 1, name: 'Taxa de falsos positivos (FPR)', nameLocation: 'middle', nameGap: 26, ...ax },
    yAxis: { type: 'value', min: 0, max: 1, name: 'TPR (recall)', ...ax },
    series: [
      ...rocs.map((r, i) => ({ name: `${r.name} (AUC ${num3(r.auc)})`, type: 'line', data: r.pts, symbol: 'none', smooth: false, lineStyle: { width: i === 0 ? 3.5 : 1.8, opacity: i === 0 ? 1 : 0.8 }, ...(i === 0 ? { areaStyle: { color: 'rgba(59,130,246,.12)' } } : {}) })),
      { name: 'Aleatório', type: 'line', data: [[0, 0], [1, 1]], symbol: 'none', lineStyle: { type: 'dashed', color: ct.muted, width: 1.5 }, silent: true, tooltip: { show: false } },
    ],
  }), [rocs, ct]);

  /* 14 ─ Importância das features */
  const feat = useMemo(() => featureImportance(cur).reverse(), [cur]);
  const optFeat = useMemo(() => ({
    grid: { left: 8, right: 48, top: 8, bottom: 4, containLabel: true },
    tooltip: tip(ct, { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: (v: number) => pct(v) }),
    xAxis: { type: 'value', ...ax, axisLabel: { ...ax.axisLabel, formatter: '{value}%' } },
    yAxis: { type: 'category', data: feat.map((f) => f.label), ...ax, splitLine: { show: false } },
    series: [{
      type: 'bar', barWidth: 18, data: feat.map((f) => f.value),
      itemStyle: { borderRadius: [0, 6, 6, 0], color: { type: 'linear', x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: PALETTE.cyan }, { offset: 1, color: PALETTE.green }] } },
      label: { show: true, position: 'right', color: ct.text, formatter: (p: { value: number }) => pct(p.value) },
    }],
  }), [feat, ct]);

  /* 15 ─ Drift (PSI) */
  const drift = useMemo(() => {
    const count = def.buckets;
    return { v: driftSeries(dim, range, count) };
  }, [dim, range, def]);
  const { labels } = usePeriod();
  const lastPsi = [...drift.v].reverse().find((v) => v !== null) ?? null;
  const status = lastPsi === null ? { t: 'Sem dados suficientes', c: 'text-slate-400' } : lastPsi < 0.1 ? { t: 'Estável', c: 'text-emerald-500' } : lastPsi < 0.25 ? { t: 'Atenção', c: 'text-amber-500' } : { t: 'Drift crítico', c: 'text-rose-500' };
  const optDrift = useMemo(() => ({
    grid: { left: 8, right: 56, top: 16, bottom: 4, containLabel: true },
    tooltip: tip(ct, { trigger: 'axis', valueFormatter: (v: number | null) => (v == null ? '—' : num3(v)) }),
    xAxis: { type: 'category', data: labels, boundaryGap: false, ...ax, splitLine: { show: false } },
    yAxis: { type: 'value', min: 0, ...ax, name: 'PSI' },
    visualMap: { show: false, type: 'piecewise', dimension: 1, seriesIndex: 0, pieces: [{ lte: 0.1, color: PALETTE.green }, { gt: 0.1, lte: 0.25, color: PALETTE.amber }, { gt: 0.25, color: PALETTE.rose }] },
    series: [{
      name: 'PSI do score', type: 'line', data: drift.v, smooth: true, connectNulls: true, symbolSize: 7, showSymbol: drift.v.length <= 15, lineStyle: { width: 3 },
      markLine: { silent: true, symbol: 'none', data: [
        { yAxis: 0.1, lineStyle: { color: PALETTE.amber, type: 'dashed' }, label: { formatter: 'Atenção 0,10', color: PALETTE.amber, fontSize: 10, position: 'insideEndTop' } },
        { yAxis: 0.25, lineStyle: { color: PALETTE.rose, type: 'dashed' }, label: { formatter: 'Crítico 0,25', color: PALETTE.rose, fontSize: 10, position: 'insideEndTop' } },
      ] },
    }],
  }), [drift, labels, ct]);

  if (!cur.length) return <Card title="Sem dados"><Empty /></Card>;

  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Precisão" value={pct(k.precision)} icon={Target} cur={k.precision} prev={pk.precision} mode="pp" color={PALETTE.blue} />
        <KpiCard label="Recall" value={pct(k.recall)} icon={Crosshair} cur={k.recall} prev={pk.recall} mode="pp" color={PALETTE.violet} delay={0.04} />
        <KpiCard label="F1-score" value={pct(k.f1)} icon={BadgeCheck} cur={k.f1} prev={pk.f1} mode="pp" color={PALETTE.cyan} delay={0.08} />
        <KpiCard label="AUC" value={num3(k.auc)} icon={Activity} cur={k.auc} prev={pk.auc} color={PALETTE.green} delay={0.12} />
        <KpiCard label="Latência média" value={ms(k.latencyAvg)} icon={Gauge} cur={k.latencyAvg} prev={pk.latencyAvg} lowerBetter color={PALETTE.amber} delay={0.16} />
        <KpiCard label="Predições" value={int(k.predictions)} icon={Zap} cur={k.predictions} prev={pk.predictions} color={PALETTE.rose} delay={0.2} />
      </div>
      <div className="card flex flex-wrap items-center gap-x-6 gap-y-2 p-4 text-sm">
        <label className="flex items-center gap-3">
          <span className="font-medium">Limiar de decisão (churn)</span>
          <input type="range" min={0.05} max={0.95} step={0.05} value={threshold} onChange={(e) => setThreshold(parseFloat(e.target.value))} className="w-44 accent-violet-500" aria-label="Limiar de decisão" />
          <b className="w-10 tabular-nums">{num2(threshold)}</b>
        </label>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          Afeta precisão, recall, F1, acurácia e a matriz de confusão · Latência p95: {ms(k.latencyP95)} · Acurácia: {pct(k.accuracy)} · Modelo principal: {MODELS[0]}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-6">
        <Card className="lg:col-span-3" title="11 · Comparação de algoritmos" subtitle="Mesmos registros e limiar; ordenado pela métrica"
          actions={<Select label="Métrica" value={algoMetric} onChange={setAlgoMetric} options={ALGO_OPTS} />}>
          <Chart option={optAlgo} height={300} />
        </Card>
        <Card className="lg:col-span-3" title="12 · Matriz de confusão" subtitle={`XGBoost · limiar ${num2(threshold)} · N = ${int(cur.length)}`}>
          <Chart option={optCm} height={300} />
        </Card>
        <Card className="lg:col-span-3" title="13 · Curva ROC e AUC" subtitle="Churn: um modelo por curva (destaque: XGBoost)">
          <Chart option={optRoc} height={340} />
        </Card>
        <Card className="lg:col-span-3" title="14 · Importância das features" subtitle="|Correlação com churn| normalizada (soma = 100%)">
          <Chart option={optFeat} height={340} />
        </Card>
        <Card className="lg:col-span-6" title="15 · Monitoramento de drift do modelo" subtitle="PSI do score de churn vs. base de referência (primeiros 90 dias) · janelas de 7 dias para visão diária"
          actions={<span className={`text-sm font-semibold ${status.c}`}>● {status.t}{lastPsi !== null ? ` · PSI ${num3(lastPsi)}` : ''}</span>}>
          <Chart option={optDrift} height={280} />
        </Card>
      </div>
    </>
  );
}


