import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { DataFactory, buildDataset } from '../data/generate';
import { PeriodKey, getRange, inRange } from '../data/aggregate';
import { DataRecord, Region, Segment } from '../data/types';

export interface ChartTheme {
  isDark: boolean;
  text: string;
  muted: string;
  grid: string;
  tooltipBg: string;
  mid: string;
}
export const PALETTE = {
  blue: '#3b82f6',
  violet: '#8b5cf6',
  green: '#10b981',
  cyan: '#06b6d4',
  amber: '#f59e0b',
  rose: '#f43f5e',
};
export const SERIES_COLORS = [PALETTE.blue, PALETTE.violet, PALETTE.cyan, PALETTE.green, PALETTE.amber, PALETTE.rose];

interface Ctx {
  period: PeriodKey;
  setPeriod: (p: PeriodKey) => void;
  segment: Segment | 'all';
  setSegment: (s: Segment | 'all') => void;
  region: Region | 'all';
  setRegion: (r: Region | 'all') => void;
  compare: boolean;
  setCompare: (b: boolean) => void;
  live: boolean;
  setLive: (b: boolean) => void;
  threshold: number;
  setThreshold: (t: number) => void;
  isDark: boolean;
  toggleTheme: () => void;
  ct: ChartTheme;
  loading: boolean;
  error: string | null;
  all: DataRecord[];
  dim: DataRecord[]; // filtrado por segmento/região (todo o histórico)
  cur: DataRecord[]; // dim + período atual
  prev: DataRecord[]; // dim + período anterior equivalente
  refresh: () => void;
  lastUpdate: Date | null;
}

const DashCtx = createContext<Ctx | null>(null);
export const useDash = () => {
  const c = useContext(DashCtx);
  if (!c) throw new Error('useDash fora do provider');
  return c;
};

const readTheme = (): boolean => {
  try {
    return localStorage.getItem('theme') !== 'light';
  } catch {
    return true;
  }
};

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [period, setPeriod] = useState<PeriodKey>('12m');
  const [segment, setSegment] = useState<Segment | 'all'>('all');
  const [region, setRegion] = useState<Region | 'all'>('all');
  const [compare, setCompare] = useState(true);
  const [live, setLive] = useState(false);
  const [threshold, setThreshold] = useState(0.5);
  const [isDark, setIsDark] = useState(readTheme);
  const [all, setAll] = useState<DataRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const factory = useRef<DataFactory | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    try {
      localStorage.setItem('theme', isDark ? 'dark' : 'light');
    } catch {
      /* ignore */
    }
  }, [isDark]);

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const ds = buildDataset();
        factory.current = ds.factory;
        setAll(ds.records);
        setLastUpdate(new Date());
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, []);

  const refresh = useCallback(() => {
    const f = factory.current;
    if (!f) return;
    const batch = f.liveBatch(12 + Math.floor(Math.random() * 25));
    setAll((a) => a.concat(batch));
    setLastUpdate(new Date());
  }, []);

  useEffect(() => {
    if (!live) return;
    const id = setInterval(refresh, 2500);
    return () => clearInterval(id);
  }, [live, refresh]);

  const dim = useMemo(
    () => all.filter((r) => (segment === 'all' || r.segment === segment) && (region === 'all' || r.region === region)),
    [all, segment, region],
  );
  const cur = useMemo(() => inRange(dim, getRange(period)), [dim, period]);
  const prev = useMemo(() => inRange(dim, getRange(period, true)), [dim, period]);

  const ct: ChartTheme = useMemo(
    () =>
      isDark
        ? { isDark, text: '#e2e8f0', muted: '#94a3b8', grid: 'rgba(148,163,184,0.16)', tooltipBg: 'rgba(15,23,42,0.96)', mid: '#1e293b' }
        : { isDark, text: '#1e293b', muted: '#64748b', grid: 'rgba(100,116,139,0.2)', tooltipBg: 'rgba(255,255,255,0.98)', mid: '#f1f5f9' },
    [isDark],
  );

  const value: Ctx = {
    period, setPeriod, segment, setSegment, region, setRegion, compare, setCompare, live, setLive,
    threshold, setThreshold, isDark, toggleTheme: () => setIsDark((d) => !d), ct, loading, error,
    all, dim, cur, prev, refresh, lastUpdate,
  };
  return <DashCtx.Provider value={value}>{children}</DashCtx.Provider>;
}
