import { useEffect, useRef, useState } from 'react';
import * as echarts from 'echarts';
import { ChartTheme, useDash } from '../context/DashboardContext';

/** Opções comuns (tooltip, fonte, cores) por tema. */
export const tip = (ct: ChartTheme, extra: Record<string, unknown> = {}) => ({
  backgroundColor: ct.tooltipBg,
  borderColor: ct.grid,
  textStyle: { color: ct.text, fontSize: 12 },
  extraCssText: 'border-radius:10px;box-shadow:0 8px 30px rgba(0,0,0,.35)',
  ...extra,
});
export const axisCommon = (ct: ChartTheme) => ({
  axisLabel: { color: ct.muted, fontSize: 11 },
  axisLine: { lineStyle: { color: ct.grid } },
  axisTick: { show: false },
  splitLine: { lineStyle: { color: ct.grid, type: 'dashed' as const } },
  nameTextStyle: { color: ct.muted },
});
export const gradient = (rgb: string, a = 0.35) => ({
  type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
  colorStops: [
    { offset: 0, color: `rgba(${rgb},${a})` },
    { offset: 1, color: `rgba(${rgb},0)` },
  ],
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Opt = Record<string, any>;

export function Chart({ option, height = 300 }: { option: Opt; height?: number }) {
  const { ct } = useDash();
  const ref = useRef<HTMLDivElement>(null);
  const inst = useRef<echarts.ECharts | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const el = ref.current!;
    const c = echarts.init(el);
    inst.current = c;
    const ro = new ResizeObserver(() => c.resize());
    ro.observe(el);
    return () => {
      ro.disconnect();
      c.dispose();
      inst.current = null;
    };
  }, []);

  useEffect(() => {
    const c = inst.current;
    if (!c) return;
    try {
      c.setOption(
        { backgroundColor: 'transparent', textStyle: { color: ct.text, fontFamily: 'Inter, sans-serif' }, animationDuration: 700, ...option },
        true,
      );
      ref.current!.dataset.ready = '1';
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }, [option, ct]);

  return (
    <div className="relative" style={{ height }}>
      <div ref={ref} data-chart className="h-full w-full" />
      {err && (
        <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-rose-500/10 p-4 text-center text-xs text-rose-400">
          Erro ao renderizar gráfico: {err}
        </div>
      )}
    </div>
  );
}
