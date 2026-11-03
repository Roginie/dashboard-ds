import { useMemo, useState } from 'react';
import { PALETTE, useDash } from '../context/DashboardContext';
import {
  METRICS, MetricKey, VARIABLES, VarKey, boxStats, bucketValues, histogram, linreg, mean, pearson, quantile, sortedCopy, std, varDef,
} from '../data/aggregate';
import { REGIONS, SEGMENTS } from '../data/types';
import { Chart, axisCommon, gradient, tip } from '../components/Chart';
import { Card, Empty, Segmented, Select } from '../components/ui';
import { int, num2, pct } from '../lib/format';
import { usePeriod } from './usePeriod';

const varOpts = VARIABLES.map((v) => ({ value: v.key, label: v.label }));

export default function Analysis() {
  const { cur, ct, compare } = useDash();
  const { labels, curB, prevB } = usePeriod();
  const [histVar, setHistVar] = useState<VarKey>('revenue');
  const [boxVar, setBoxVar] = useState<VarKey>('revenue');
  const [boxDim, setBoxDim] = useState<'segment' | 'region'>('segment');
  const [xVar, setXVar] = useState<VarKey>('engagement');
  const [yVar, setYVar] = useState<VarKey>('revenue');
  const [trendMetric, setTrendMetric] = useState<MetricKey>('revenue');
  const ax = axisCommon(ct);
  const grid = { left: 8, right: 16, top: 34, bottom: 4, containLabel: true };
  const legend = { top: 0, right: 0, textStyle: { color: ct.muted, fontSize: 11 }, itemWidth: 14, itemHeight: 8 };

  /* 6 ─ Matriz de correlação */
  const optCorr = useMemo(() => {
    const cols = VARIABLES.map((v) => cur.map(v.get));
    const data: [number, number, number][] = [];
    VARIABLES.forEach((_, i) => VARIABLES.forEach((__, j) => data.push([j, i, Math.round(pearson(cols[i], cols[j]) * 100) / 100])));
    const names = VARIABLES.map((v) => v.label.replace(/ \(.*\)/, ''));
    return {
      tooltip: tip(ct, { formatter: (p: { value: number[] }) => `${names[p.value[1]]} × ${names[p.value[0]]}<br/>r de Pearson = <b>${num2(p.value[2])}</b>` }),
      grid: { left: 8, right: 16, top: 8, bottom: 56, containLabel: true },
      xAxis: { type: 'category', data: names, ...ax, splitLine: { show: false }, axisLabel: { ...ax.axisLabel, rotate: 30, interval: 0 }, splitArea: { show: false } },
      yAxis: { type: 'category', data: names, inverse: true, ...ax, splitLine: { show: false }, axisLabel: { ...ax.axisLabel, interval: 0 } },
      visualMap: { min: -1, max: 1, orient: 'horizontal', left: 'center', bottom: 0, itemWidth: 12, itemHeight: 140, calculable: false, textStyle: { color: ct.muted, fontSize: 10 }, inRange: { color: [PALETTE.violet, ct.mid, PALETTE.cyan] } },
      series: [{
        type: 'heatmap', data, label: { show: true, color: ct.text, fontSize: 10, formatter: (p: { value: number[] }) => num2(p.value[2]) },
        itemStyle: { borderColor: ct.isDark ? '#0b1020' : '#fff', borderWidth: 2, borderRadius: 3 }, emphasis: { itemStyle: { borderColor: ct.text } },
      }],
    };
  }, [cur, ct]);

  /* 7 ─ Histograma */
  const hv = varDef(histVar);
  const histVals = useMemo(() => cur.map(hv.get), [cur, hv]);
  const hist = useMemo(() => histogram(histVals), [histVals]);
  const desc = useMemo(() => {
    const s = sortedCopy(histVals);
    return { n: s.length, mean: mean(s), sd: std(s), min: s[0] ?? 0, p25: quantile(s, 0.25), med: quantile(s, 0.5), p75: quantile(s, 0.75), p95: quantile(s, 0.95), max: s[s.length - 1] ?? 0 };
  }, [histVals]);
  const optHist = useMemo(() => {
    const idx = (v: number) => Math.max(0, Math.min(hist.counts.length - 1, Math.floor((v - hist.min) / (hist.width || 1))));
    const ml = (v: number, name: string, color: string) => ({ xAxis: idx(v), name, lineStyle: { color, type: 'dashed', width: 2 }, label: { color, formatter: `${name}: ${hv.fmt(v)}`, fontSize: 10, position: 'insideEndTop' } });
    return {
      grid: { left: 8, right: 16, top: 24, bottom: 4, containLabel: true },
      tooltip: tip(ct, { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: (ps: { dataIndex: number; value: number }[]) => {
        const i = ps[0].dataIndex; const lo = hist.min + i * hist.width;
        return `${hv.fmt(lo)} – ${hv.fmt(lo + hist.width)}<br/><b>${int(ps[0].value)}</b> registros (${pct((ps[0].value / (desc.n || 1)) * 100)})`;
      } }),
      xAxis: { type: 'category', data: hist.centers.map((c) => (Math.abs(c) >= 1000 ? Math.round(c).toLocaleString('pt-BR') : c.toLocaleString('pt-BR', { maximumFractionDigits: 1 }))), ...ax, splitLine: { show: false }, axisLabel: { ...ax.axisLabel, interval: 'auto' } },
      yAxis: { type: 'value', ...ax },
      series: [{
        type: 'bar', data: hist.counts, barCategoryGap: '8%', itemStyle: { borderRadius: [4, 4, 0, 0], color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: PALETTE.violet }, { offset: 1, color: PALETTE.blue }] } },
        markLine: { symbol: 'none', silent: true, data: [ml(desc.mean, 'Média', PALETTE.amber), ml(desc.med, 'Mediana', PALETTE.green)] },
      }],
    };
  }, [hist, desc, hv, ct]);

  /* 8 ─ Boxplot / outliers */
  const bv = varDef(boxVar);
  const box = useMemo(() => {
    const groups = (boxDim === 'segment' ? SEGMENTS : REGIONS).map((g) => ({ g, s: boxStats(cur.filter((r) => r[boxDim] === g).map(bv.get)) }));
    return groups.filter((x) => x.s) as { g: string; s: NonNullable<ReturnType<typeof boxStats>> }[];
  }, [cur, boxDim, bv]);
  const optBox = useMemo(() => ({
    grid: { left: 8, right: 16, top: 24, bottom: 4, containLabel: true },
    tooltip: tip(ct, { trigger: 'item', formatter: (p: { seriesType: string; name: string; value: number[] | (string | number)[]; marker: string }) => {
      if (p.seriesType === 'scatter') return `Outlier em <b>${p.name}</b>: ${bv.fmt(p.value[1] as number)}`;
      const b = box.find((x) => x.g === p.name)!.s;
      return `<b>${p.name}</b> (n=${int(b.n)})<br/>Máx (sem outliers): ${bv.fmt(b.high)}<br/>Q3: ${bv.fmt(b.q3)}<br/>Mediana: ${bv.fmt(b.med)}<br/>Q1: ${bv.fmt(b.q1)}<br/>Mín: ${bv.fmt(b.low)}<br/>Outliers: ${int(b.outliers.length)}`;
    } }),
    xAxis: { type: 'category', data: box.map((b) => b.g), ...ax, splitLine: { show: false } },
    yAxis: { type: 'value', ...ax, scale: true },
    series: [
      { type: 'boxplot', data: box.map((b) => [b.s.low, b.s.q1, b.s.med, b.s.q3, b.s.high]), itemStyle: { color: 'rgba(59,130,246,.25)', borderColor: PALETTE.blue, borderWidth: 2 }, emphasis: { itemStyle: { borderColor: PALETTE.cyan } } },
      { type: 'scatter', symbolSize: 5, itemStyle: { color: PALETTE.rose, opacity: 0.7 }, data: box.flatMap((b) => {
        const o = b.s.outliers; const stride = Math.max(1, Math.ceil(o.length / 150));
        return o.filter((_, i) => i % stride === 0).map((v) => [b.g, v]);
      }) },
    ],
  }), [box, bv, ct]);
  const totalOut = box.reduce((a, b) => a + b.s.outliers.length, 0);

  /* 9 ─ Scatter */
  const xd = varDef(xVar), yd = varDef(yVar);
  const sc = useMemo(() => {
    const r = pearson(cur.map(xd.get), cur.map(yd.get));
    const stride = Math.max(1, Math.ceil(cur.length / 1500));
    const pts = cur.filter((_, i) => i % stride === 0);
    return { r, stay: pts.filter((p) => p.churn === 0).map((p) => [xd.get(p), yd.get(p)]), churn: pts.filter((p) => p.churn === 1).map((p) => [xd.get(p), yd.get(p)]), shown: pts.length };
  }, [cur, xd, yd]);
  const optScatter = useMemo(() => ({
    grid: { left: 8, right: 16, top: 34, bottom: 24, containLabel: true }, legend,
    tooltip: tip(ct, { trigger: 'item', formatter: (p: { seriesName: string; value: number[]; marker: string }) => `${p.marker} ${p.seriesName}<br/>${xd.label}: <b>${xd.fmt(p.value[0])}</b><br/>${yd.label}: <b>${yd.fmt(p.value[1])}</b>` }),
    xAxis: { type: 'value', name: xd.label, nameLocation: 'middle', nameGap: 28, scale: true, ...ax }, yAxis: { type: 'value', name: yd.label, scale: true, ...ax },
    series: [
      { name: 'Retido', type: 'scatter', symbolSize: 6, data: sc.stay, itemStyle: { color: PALETTE.green, opacity: 0.55 } },
      { name: 'Churn', type: 'scatter', symbolSize: 7, data: sc.churn, itemStyle: { color: PALETTE.rose, opacity: 0.75 } },
    ],
  }), [sc, xd, yd, ct]);

  /* 10 ─ Tendência */
  const tm = METRICS[trendMetric];
  const trend = useMemo(() => {
    const y = bucketValues(curB, tm.agg, tm.kind);
    const { slope, intercept } = linreg(y);
    const fit = y.map((_, i) => intercept + slope * i);
    const ma = y.map((_, i) => { const w = y.slice(Math.max(0, i - 2), i + 1).filter((v): v is number => v !== null); return w.length ? mean(w) : null; });
    const first = fit[0] || 1;
    return { y, fit, ma, slope, pctChange: ((fit[fit.length - 1] - fit[0]) / Math.abs(first)) * 100, prevY: bucketValues(prevB, tm.agg, tm.kind) };
  }, [curB, prevB, tm]);
  const optTrend = useMemo(() => ({
    grid, legend, color: [PALETTE.blue, PALETTE.green, PALETTE.amber, PALETTE.violet],
    tooltip: tip(ct, { trigger: 'axis', valueFormatter: (v: number | null) => (v == null ? '—' : tm.fmt(v)) }),
    xAxis: { type: 'category', data: labels, ...ax, splitLine: { show: false }, boundaryGap: false },
    yAxis: { type: 'value', scale: true, ...ax, axisLabel: { ...ax.axisLabel, formatter: (v: number) => tm.short(v) } },
    series: [
      { name: tm.label, type: 'line', data: trend.y, smooth: true, connectNulls: true, symbolSize: 6, showSymbol: trend.y.length <= 15, lineStyle: { width: 2.5 }, areaStyle: { color: gradient('59,130,246', 0.25) } },
      { name: 'Média móvel (3)', type: 'line', data: trend.ma, smooth: true, symbol: 'none', lineStyle: { width: 2, color: PALETTE.green } },
      { name: 'Tendência linear', type: 'line', data: trend.fit, symbol: 'none', lineStyle: { width: 2, type: 'dashed', color: PALETTE.amber } },
      ...(compare ? [{ name: 'Período anterior', type: 'line', data: trend.prevY, smooth: true, symbol: 'none', connectNulls: true, lineStyle: { width: 1.5, type: 'dotted', color: PALETTE.violet } }] : []),
    ],
  }), [trend, tm, labels, compare, ct]);

  if (!cur.length) return <Card title="Sem dados"><Empty /></Card>;
  const statRow = (l: string, v: number) => (
    <div key={l} className="flex justify-between border-b border-slate-200/60 py-1 text-xs last:border-0 dark:border-white/5"><span className="text-slate-500 dark:text-slate-400">{l}</span><b>{hv.fmt(v)}</b></div>
  );

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-6">
      <Card className="lg:col-span-3" title="6 · Matriz de correlação" subtitle="r de Pearson entre variáveis (registros do período)">
        <Chart option={optCorr} height={360} />
      </Card>
      <Card className="lg:col-span-3" title="7 · Distribuição estatística" subtitle={`Histograma de ${hv.label} · ${int(desc.n)} registros`}
        actions={<Select label="Variável do histograma" value={histVar} onChange={setHistVar} options={varOpts.filter((o) => o.value !== 'churn')} />}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_150px]">
          <Chart option={optHist} height={330} />
          <div className="self-center rounded-xl bg-slate-50 p-3 dark:bg-white/[0.03]">
            {statRow('Média', desc.mean)}{statRow('Desvio-padrão', desc.sd)}{statRow('Mínimo', desc.min)}{statRow('P25', desc.p25)}
            {statRow('Mediana', desc.med)}{statRow('P75', desc.p75)}{statRow('P95', desc.p95)}{statRow('Máximo', desc.max)}
          </div>
        </div>
      </Card>
      <Card className="lg:col-span-3" title="8 · Identificação de outliers" subtitle={`Boxplot de ${bv.label} (critério de Tukey 1,5×IQR) · ${int(totalOut)} outliers`}
        actions={<>
          <Select label="Variável do boxplot" value={boxVar} onChange={setBoxVar} options={varOpts.filter((o) => o.value !== 'churn')} />
          <Segmented label="Agrupar por" value={boxDim} onChange={setBoxDim} options={[{ value: 'segment', label: 'Segmento' }, { value: 'region', label: 'Região' }]} />
        </>}>
        <Chart option={optBox} height={330} />
      </Card>
      <Card className="lg:col-span-3" title="9 · Relação entre variáveis" subtitle={`r de Pearson = ${num2(sc.r)} · ${int(sc.shown)} pontos exibidos (amostra uniforme)`}
        actions={<>
          <Select label="Eixo X" value={xVar} onChange={setXVar} options={varOpts.filter((o) => o.value !== 'churn')} />
          <Select label="Eixo Y" value={yVar} onChange={setYVar} options={varOpts.filter((o) => o.value !== 'churn')} />
        </>}>
        <Chart option={optScatter} height={330} />
      </Card>
      <Card className="lg:col-span-6" title="10 · Análise de tendências" subtitle={`Inclinação: ${tm.fmt(trend.slope)} por período · variação estimada no intervalo: ${trend.pctChange >= 0 ? '+' : ''}${num2(trend.pctChange)}%`}
        actions={<Select label="Métrica da tendência" value={trendMetric} onChange={setTrendMetric} options={(Object.keys(METRICS) as MetricKey[]).map((v) => ({ value: v, label: METRICS[v].label }))} />}>
        <Chart option={optTrend} height={320} />
      </Card>
    </div>
  );
}

