import { useMemo, useState } from 'react';
import { Activity, DollarSign, Percent, Receipt, UserMinus, Users } from 'lucide-react';
import { PALETTE, useDash } from '../context/DashboardContext';
import { METRICS, MetricKey, bucketValues, computeKpis, holt, mean } from '../data/aggregate';
import { REGIONS, SEGMENTS } from '../data/types';
import { Chart, axisCommon, gradient, tip } from '../components/Chart';
import { Card, Empty, KpiCard, Segmented, Select } from '../components/ui';
import { brl, brlShort, compact, int, num1, pct } from '../lib/format';
import { usePeriod } from './usePeriod';

export default function Executive() {
  const { cur, prev, ct, compare, threshold, period } = useDash();
  const { def, labels, curB, prevB } = usePeriod();
  const [metric, setMetric] = useState<MetricKey>('revenue');
  const [dimKey, setDimKey] = useState<'segment' | 'region'>('segment');

  const k = useMemo(() => computeKpis(cur, threshold), [cur, threshold]);
  const pk = useMemo(() => computeKpis(prev, threshold), [prev, threshold]);
  const ax = axisCommon(ct);
  const cat = { type: 'category', data: labels, boundaryGap: false, ...ax, splitLine: { show: false } };
  const legend = { top: 0, right: 0, textStyle: { color: ct.muted, fontSize: 11 }, itemWidth: 14, itemHeight: 8 };
  const grid = { left: 8, right: 12, top: 34, bottom: 4, containLabel: true };

  const spark = useMemo(
    () => ({
      revenue: bucketValues(curB, METRICS.revenue.agg),
      ticket: bucketValues(curB, (rs) => METRICS.revenue.agg(rs) / (METRICS.transactions.agg(rs) || 1), 'avg'),
      clients: bucketValues(curB, METRICS.clients.agg),
      churn: bucketValues(curB, METRICS.churn.agg, 'avg'),
      retention: bucketValues(curB, (rs) => 100 - METRICS.churn.agg(rs), 'avg'),
      conversion: bucketValues(curB, METRICS.conversion.agg, 'avg'),
    }),
    [curB],
  );

  /* 1 ─ Receita (métrica selecionável) */
  const m = METRICS[metric];
  const optLine = useMemo(() => {
    const series: object[] = [
      {
        name: 'Período atual', type: 'line', smooth: true, showSymbol: curB.length <= 15, symbolSize: 6, connectNulls: true,
        data: bucketValues(curB, m.agg, m.kind), lineStyle: { width: 3, color: PALETTE.blue }, itemStyle: { color: PALETTE.blue },
        areaStyle: { color: gradient('59,130,246') },
      },
    ];
    if (compare)
      series.push({
        name: 'Período anterior', type: 'line', smooth: true, showSymbol: false, connectNulls: true,
        data: bucketValues(prevB, m.agg, m.kind), lineStyle: { width: 2, type: 'dashed', color: PALETTE.violet }, itemStyle: { color: PALETTE.violet },
      });
    return {
      grid, legend, color: [PALETTE.blue, PALETTE.violet],
      tooltip: tip(ct, { trigger: 'axis', valueFormatter: (v: number | null) => (v == null ? '—' : m.fmt(v)) }),
      xAxis: cat, yAxis: { type: 'value', ...ax, axisLabel: { ...ax.axisLabel, formatter: (v: number) => m.short(v) } }, series,
    };
  }, [curB, prevB, compare, m, ct]);

  /* 2 ─ Receita real vs. prevista (Holt) */
  const optForecast = useMemo(() => {
    const real = bucketValues(curB, METRICS.revenue.agg);
    const { fitted, future, sigma } = holt(real, 2);
    const band = 1.96 * sigma;
    const xs = [...labels, 'Prev. +1', 'Prev. +2'];
    const pred = [...fitted, ...future];
    const lower = pred.map((v) => Math.max(0, v - band));
    return {
      grid, legend: { ...legend, data: ['Real', 'Previsto'] }, color: [PALETTE.cyan, PALETTE.violet],
      tooltip: tip(ct, {
        trigger: 'axis',
        formatter: (ps: { axisValueLabel: string; seriesName: string; value: number | null; marker: string }[]) =>
          `<b>${ps[0].axisValueLabel}</b><br/>` +
          ps.filter((p) => p.seriesName === 'Real' || p.seriesName === 'Previsto')
            .map((p) => `${p.marker} ${p.seriesName}: <b>${p.value == null ? '—' : brl(p.value)}</b>`).join('<br/>') +
          `<br/><span style="opacity:.6">IC 95%: ±${brl(band)}</span>`,
      }),
      xAxis: { ...cat, data: xs }, yAxis: { type: 'value', ...ax, axisLabel: { ...ax.axisLabel, formatter: (v: number) => brlShort(v) } },
      series: [
        { name: 'Banda', type: 'line', stack: 'ic', data: lower, symbol: 'none', lineStyle: { opacity: 0 }, silent: true },
        { name: 'Banda IC', type: 'line', stack: 'ic', data: pred.map((_, i) => lower[i] === 0 ? pred[i] + band : 2 * band), symbol: 'none', lineStyle: { opacity: 0 }, areaStyle: { color: 'rgba(139,92,246,.14)' }, silent: true },
        { name: 'Real', type: 'line', smooth: true, symbol: 'none', data: [...real, null, null], lineStyle: { width: 3, color: PALETTE.cyan }, areaStyle: { color: gradient('6,182,212', 0.3) } },
        { name: 'Previsto', type: 'line', smooth: true, symbol: 'none', data: pred, lineStyle: { width: 2.5, type: 'dashed', color: PALETTE.violet } },
      ],
    };
  }, [curB, labels, ct]);

  /* 3 ─ Crescimento de clientes (novos vs. recorrentes) */
  const optClients = useMemo(() => {
    const active = curB.map((b) => new Set(b.map((r) => r.customerId)).size);
    const novos = curB.map((b) => b.filter((r) => r.isFirst).length);
    const recorrentes = active.map((a, i) => a - novos[i]);
    return {
      grid, legend, color: [PALETTE.green, PALETTE.blue],
      tooltip: tip(ct, { trigger: 'axis', axisPointer: { type: 'shadow' } }),
      xAxis: { ...cat, boundaryGap: true }, yAxis: { type: 'value', ...ax },
      series: [
        { name: 'Novos', type: 'bar', stack: 'c', data: novos, itemStyle: { color: PALETTE.green, borderRadius: [0, 0, 0, 0] } },
        { name: 'Recorrentes', type: 'bar', stack: 'c', data: recorrentes, itemStyle: { color: PALETTE.blue, borderRadius: [4, 4, 0, 0] } },
      ],
    };
  }, [curB, ct]);

  /* 4 ─ Distribuição de clientes (rosca) */
  const donut = useMemo(() => {
    const keys = dimKey === 'segment' ? SEGMENTS : REGIONS;
    const data = keys
      .map((n) => ({ name: n, value: new Set(cur.filter((r) => r[dimKey] === n).map((r) => r.customerId)).size }))
      .filter((d) => d.value > 0);
    const total = new Set(cur.map((r) => r.customerId)).size;
    return { data, total };
  }, [cur, dimKey]);
  const optDonut = useMemo(
    () => ({
      color: [PALETTE.blue, PALETTE.violet, PALETTE.cyan, PALETTE.green, PALETTE.amber],
      tooltip: tip(ct, { trigger: 'item', formatter: '{b}<br/><b>{c}</b> clientes ({d}%)' }),
      legend: { bottom: 0, textStyle: { color: ct.muted, fontSize: 11 }, itemWidth: 10, itemHeight: 10 },
      title: { text: int(donut.total), subtext: 'clientes únicos', left: 'center', top: '34%', textStyle: { color: ct.text, fontSize: 24, fontWeight: 700 }, subtextStyle: { color: ct.muted, fontSize: 11 } },
      series: [{
        type: 'pie', radius: ['52%', '76%'], center: ['50%', '45%'], avoidLabelOverlap: true, padAngle: 2,
        itemStyle: { borderRadius: 8, borderColor: 'transparent', borderWidth: 2 }, label: { show: false },
        emphasis: { scaleSize: 6, label: { show: false } }, data: donut.data,
      }],
    }),
    [donut, ct],
  );

  /* 5 ─ Funil de conversão */
  const optFunnel = useMemo(() => {
    const names = ['Registros ativos', 'Engajados', 'Qualificados', 'Propostas', 'Convertidos'];
    const colors = [PALETTE.blue, '#6366f1', PALETTE.violet, PALETTE.cyan, PALETTE.green];
    return {
      tooltip: tip(ct, {
        trigger: 'item',
        formatter: (p: { name: string; value: number; dataIndex: number }) => {
          const prevV = k.funnel[Math.max(0, p.dataIndex - 1)] || 1;
          return `<b>${p.name}</b><br/>${int(p.value)} (${pct((p.value / (k.funnel[0] || 1)) * 100)} do topo)<br/>` +
            (p.dataIndex ? `${pct((p.value / prevV) * 100)} da etapa anterior` : '');
        },
      }),
      series: [{
        type: 'funnel', left: '4%', width: '92%', top: 8, bottom: 8, minSize: '18%', gap: 3, sort: 'descending',
        label: { show: true, position: 'inside', color: '#fff', fontSize: 12, formatter: (p: { name: string; value: number }) => `${p.name}  ${compact(p.value)}` },
        itemStyle: { borderWidth: 0, borderRadius: 4 },
        data: k.funnel.map((v, i) => ({ name: names[i], value: v, itemStyle: { color: colors[i] } })),
      }],
    };
  }, [k, ct]);

  const noData = cur.length === 0;
  const kp = [
    { label: 'Receita total', value: brl(k.revenue), icon: DollarSign, cur: k.revenue, prev: pk.revenue, spark: spark.revenue, color: PALETTE.blue },
    { label: 'Ticket médio', value: brl(k.ticket), icon: Receipt, cur: k.ticket, prev: pk.ticket, spark: spark.ticket, color: PALETTE.violet },
    { label: 'Clientes ativos', value: int(k.clients), icon: Users, cur: k.clients, prev: pk.clients, spark: spark.clients, color: PALETTE.cyan },
    { label: 'Churn', value: pct(k.churn), icon: UserMinus, cur: k.churn, prev: pk.churn, mode: 'pp' as const, lowerBetter: true, spark: spark.churn, color: PALETTE.rose },
    { label: 'Retenção', value: pct(k.retention), icon: Activity, cur: k.retention, prev: pk.retention, mode: 'pp' as const, spark: spark.retention, color: PALETTE.green },
    { label: 'Conversão', value: pct(k.conversion), icon: Percent, cur: k.conversion, prev: pk.conversion, mode: 'pp' as const, spark: spark.conversion, color: PALETTE.amber },
  ];

  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {kp.map((x, i) => <KpiCard key={x.label} {...x} delay={i * 0.04} />)}
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Retenção = 100% − churn · Conversão = registros que chegaram à etapa “Convertidos” ÷ registros ativos · Período: {def.label} · {int(cur.length)} registros
        (anterior: {int(prev.length)}). Granularidade: {period === '12m' ? 'mensal' : period === '90d' ? '≈6 dias' : 'diária'}.
      </p>
      {noData ? (
        <Card title="Sem dados"><Empty /></Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-6">
          <Card className="lg:col-span-4" title="1 · Evolução temporal" subtitle={`${m.label} por período${compare ? ' · comparação com período anterior' : ''}`}
            actions={<Select label="Métrica" value={metric} onChange={setMetric} options={(Object.keys(METRICS) as MetricKey[]).map((v) => ({ value: v, label: METRICS[v].label }))} />}>
            <Chart option={optLine} height={300} />
          </Card>
          <Card className="lg:col-span-2" title="4 · Distribuição de clientes" subtitle="Clientes únicos no período"
            actions={<Segmented label="Dimensão" value={dimKey} onChange={setDimKey} options={[{ value: 'segment', label: 'Segmento' }, { value: 'region', label: 'Região' }]} />}>
            <Chart option={optDonut} height={300} />
          </Card>
          <Card className="lg:col-span-3" title="2 · Receita real vs. prevista" subtitle="Previsão: suavização exponencial de Holt (1 passo à frente) + IC 95%">
            <Chart option={optForecast} height={290} />
          </Card>
          <Card className="lg:col-span-3" title="3 · Crescimento de clientes" subtitle="Clientes ativos: novos (1º registro na base) vs. recorrentes">
            <Chart option={optClients} height={290} />
          </Card>
          <Card className="lg:col-span-6" title="5 · Funil de conversão" subtitle={`Taxa total: ${pct(k.conversion)} · Média de engajamento: ${num1(mean(cur.map((r) => r.engagement)))}`}>
            <Chart option={optFunnel} height={280} />
          </Card>
        </div>
      )}
    </>
  );
}

