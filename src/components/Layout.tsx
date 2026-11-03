import { ReactNode, useState } from 'react';
import {
  BarChart3, BrainCircuit, Download, FlaskConical, GitCompareArrows, LayoutDashboard, Menu, Moon, Radio, RefreshCw, Sun, Table2, X,
} from 'lucide-react';
import { PALETTE, useDash } from '../context/DashboardContext';
import { PERIODS } from '../data/aggregate';
import { REGIONS, SEGMENTS } from '../data/types';
import { downloadCsv } from '../lib/csv';
import { int } from '../lib/format';
import { Segmented, Select } from './ui';

export const PAGES = [
  { id: 'executivo', label: 'Visão Executiva', icon: LayoutDashboard, desc: 'Receita, clientes e funil de conversão' },
  { id: 'analise', label: 'Análise de Dados', icon: FlaskConical, desc: 'Correlações, distribuições, outliers e tendências' },
  { id: 'ml', label: 'Machine Learning', icon: BrainCircuit, desc: 'Desempenho, ROC, features e drift do modelo' },
  { id: 'dados', label: 'Base de Dados', icon: Table2, desc: 'Registros sintéticos filtrados e exportação' },
] as const;
export type PageId = (typeof PAGES)[number]['id'];

function Sidebar({ page, onNavigate }: { page: PageId; onNavigate?: () => void }) {
  const { all, live, lastUpdate } = useDash();
  return (
    <div className="flex h-full flex-col gap-6 p-4">
      <div className="flex items-center gap-2.5 px-1">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 via-violet-500 to-cyan-400 shadow-lg shadow-violet-500/30">
          <BarChart3 size={19} className="text-white" />
        </div>
        <div>
          <div className="text-base font-bold leading-tight text-slate-900 dark:text-white">DataLens BI</div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400">Ciência de Dados</div>
        </div>
      </div>
      <nav className="flex flex-col gap-1" aria-label="Navegação principal">
        {PAGES.map((p) => {
          const active = p.id === page;
          return (
            <a
              key={p.id}
              href={`#/${p.id}`}
              onClick={onNavigate}
              aria-current={active ? 'page' : undefined}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                active
                  ? 'bg-gradient-to-r from-blue-500/15 to-violet-500/15 text-blue-600 ring-1 ring-blue-500/30 dark:text-white'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white'
              }`}
            >
              <p.icon size={18} className={active ? 'text-blue-500 dark:text-cyan-300' : ''} />
              {p.label}
            </a>
          );
        })}
      </nav>
      <div className="mt-auto space-y-3">
        <div className="px-1 text-[11px] text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${live ? 'animate-pulse bg-emerald-400' : 'bg-slate-400'}`} />
            {live ? 'Atualização ao vivo' : 'Atualização pausada'}
          </div>
          <div>{int(all.length)} registros · {lastUpdate ? lastUpdate.toLocaleTimeString('pt-BR') : '—'}</div>
        </div>
      </div>
    </div>
  );
}

function Header({ page, onMenu }: { page: PageId; onMenu: () => void }) {
  const d = useDash();
  const cur = PAGES.find((p) => p.id === page)!;
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur-xl dark:border-white/10 dark:bg-ink/75">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 lg:px-6">
        <button className="btn !px-2 lg:hidden" onClick={onMenu} aria-label="Abrir menu">
          <Menu size={18} />
        </button>
        <div className="mr-auto min-w-[160px]">
          <h1 className="text-lg font-bold leading-tight text-slate-900 dark:text-white">{cur.label}</h1>
          <p className="hidden text-xs text-slate-500 dark:text-slate-400 sm:block">{cur.desc}</p>
        </div>
        <Segmented
          label="Período"
          value={d.period}
          onChange={d.setPeriod}
          options={PERIODS.map((p) => ({ value: p.key, label: p.key === '12m' ? '12 meses' : p.key === '90d' ? '90 dias' : p.label }))}
        />
        <Select
          label="Segmento"
          value={d.segment}
          onChange={d.setSegment}
          options={[{ value: 'all', label: 'Todos os segmentos' }, ...SEGMENTS.map((s) => ({ value: s, label: s }))]}
        />
        <Select
          label="Região"
          value={d.region}
          onChange={d.setRegion}
          options={[{ value: 'all', label: 'Todas as regiões' }, ...REGIONS.map((r) => ({ value: r, label: r }))]}
        />
        <button
          className={`btn ${d.compare ? '!border-violet-500/50 !text-violet-600 dark:!text-violet-300' : ''}`}
          onClick={() => d.setCompare(!d.compare)}
          aria-pressed={d.compare}
          title="Comparar com o período anterior"
        >
          <GitCompareArrows size={15} /> Comparar
        </button>
        <button
          className={`btn ${d.live ? '!border-emerald-500/50 !text-emerald-600 dark:!text-emerald-300' : ''}`}
          onClick={() => d.setLive(!d.live)}
          aria-pressed={d.live}
          title="Simula chegada de novos registros a cada 2,5 s"
        >
          <Radio size={15} className={d.live ? 'animate-pulse' : ''} /> Ao vivo
        </button>
        <button className="btn !px-2" onClick={d.refresh} aria-label="Atualizar indicadores" title="Gerar novos registros simulados">
          <RefreshCw size={15} />
        </button>
        <button
          className="btn btn-primary"
          onClick={() => downloadCsv(d.cur, d.threshold, `dados_${d.period}_${d.segment}_${d.region}`.replace(/\s/g, ''))}
          title="Exporta os registros filtrados"
        >
          <Download size={15} /> CSV <span className="hidden opacity-80 md:inline">({int(d.cur.length)})</span>
        </button>
        <button className="btn !px-2" onClick={d.toggleTheme} aria-label="Alternar tema">
          {d.isDark ? <Sun size={16} color={PALETTE.amber} /> : <Moon size={16} />}
        </button>
      </div>
    </header>
  );
}

export function Layout({ page, children }: { page: PageId; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-slate-200 bg-white/70 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.02] lg:block">
        <Sidebar page={page} />
      </aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-72 bg-white shadow-2xl dark:bg-[#0b1020]">
            <button className="btn absolute right-3 top-3 !px-2" onClick={() => setOpen(false)} aria-label="Fechar menu">
              <X size={16} />
            </button>
            <Sidebar page={page} onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}
      <div className="min-w-0 flex-1">
        <Header page={page} onMenu={() => setOpen(true)} />
        <main className="min-w-0 space-y-4 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}

