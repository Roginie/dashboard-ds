import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { ArrowDownRight, ArrowUpRight, LucideIcon, Minus } from 'lucide-react';

export function Card({
  title, subtitle, actions, children, className = '', delay = 0,
}: { title: string; subtitle?: string; actions?: ReactNode; children: ReactNode; className?: string; delay?: number }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      className={`card min-w-0 p-4 ${className}`}
    >
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </motion.section>
  );
}

export function Segmented<T extends string>({
  value, onChange, options, label,
}: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; label?: string }) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-lg border border-slate-300 bg-slate-100 p-0.5 dark:border-white/10 dark:bg-white/5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
            value === o.value
              ? 'bg-gradient-to-r from-blue-500 to-violet-500 text-white shadow'
              : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Select<T extends string>({
  value, onChange, options, label,
}: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; label: string }) {
  return (
    <select aria-label={label} className="ctl" value={value} onChange={(e) => onChange(e.target.value as T)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function Spark({ data, color }: { data: (number | null)[]; color: string }) {
  const pts = data.map((v, i) => [i, v] as const).filter((p): p is readonly [number, number] => p[1] !== null);
  if (pts.length < 2) return null;
  const ys = pts.map((p) => p[1]);
  const min = Math.min(...ys);
  const max = Math.max(...ys);
  const W = 100,
    H = 28;
  const path = pts
    .map(([i, v], k) => `${k ? 'L' : 'M'}${((i / (data.length - 1)) * W).toFixed(1)},${(H - 2 - ((v - min) / (max - min || 1)) * (H - 4)).toFixed(1)}`)
    .join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-7 w-full" preserveAspectRatio="none" aria-hidden>
      <path d={path} fill="none" stroke={color} strokeWidth="1.8" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}

export function KpiCard({
  label, value, icon: Icon, cur, prev, mode = 'rel', lowerBetter = false, spark, color, delay = 0,
}: {
  label: string; value: string; icon: LucideIcon; cur: number; prev: number; mode?: 'rel' | 'pp'; lowerBetter?: boolean;
  spark?: (number | null)[]; color: string; delay?: number;
}) {
  let delta: number | null = null;
  if (mode === 'pp') delta = cur - prev;
  else if (prev) delta = ((cur - prev) / Math.abs(prev)) * 100;
  const up = delta !== null && delta > 0.005;
  const down = delta !== null && delta < -0.005;
  const good = (up && !lowerBetter) || (down && lowerBetter);
  const bad = (up && lowerBetter) || (down && !lowerBetter);
  const tone = good ? 'text-emerald-500' : bad ? 'text-rose-500' : 'text-slate-400';
  const txt =
    delta === null
      ? '—'
      : `${delta > 0 ? '+' : ''}${delta.toLocaleString('pt-BR', { maximumFractionDigits: 1, minimumFractionDigits: 1 })}${mode === 'pp' ? ' p.p.' : '%'}`;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className="card relative overflow-hidden p-4"
      data-kpi={label}
    >
      <div className="flex items-start justify-between">
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</span>
        <span className="rounded-lg p-1.5" style={{ background: color + '22', color }}>
          <Icon size={15} />
        </span>
      </div>
      <div data-value className="mt-2 truncate text-xl font-bold tracking-tight sm:text-2xl text-slate-900 dark:text-white">{value}</div>
      <div className={`mt-1 flex items-center gap-1 text-xs font-medium ${tone}`}>
        {up ? <ArrowUpRight size={13} /> : down ? <ArrowDownRight size={13} /> : <Minus size={13} />}
        {txt}
        <span className="font-normal text-slate-400">vs. período anterior</span>
      </div>
      {spark && <div className="mt-2 opacity-90"><Spark data={spark} color={color} /></div>}
    </motion.div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton rounded-xl ${className}`} />;
}

export function Empty({ text = 'Sem dados para os filtros selecionados.' }: { text?: string }) {
  return <div className="flex h-full min-h-[120px] items-center justify-center text-sm text-slate-400">{text}</div>;
}


