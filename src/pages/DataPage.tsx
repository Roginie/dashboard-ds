import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, Search } from 'lucide-react';
import { useDash } from '../context/DashboardContext';
import { DataRecord } from '../data/types';
import { Card, Empty } from '../components/ui';
import { downloadCsv } from '../lib/csv';
import { brl2, int, num1, num2, pct } from '../lib/format';

type SortKey = 'id' | 'date' | 'customerId' | 'segment' | 'region' | 'revenue' | 'transactions' | 'engagement' | 'churn' | 'convProb' | 'score';
const COLS: { key: SortKey; label: string; right?: boolean; get: (r: DataRecord) => string | number; show: (r: DataRecord, thr: number) => React.ReactNode }[] = [
  { key: 'date', label: 'Data', get: (r) => r.d, show: (r) => r.date.split('-').reverse().join('/') },
  { key: 'customerId', label: 'Cliente', get: (r) => r.customerId, show: (r) => r.customerId },
  { key: 'segment', label: 'Segmento', get: (r) => r.segment, show: (r) => r.segment },
  { key: 'region', label: 'Região', get: (r) => r.region, show: (r) => r.region },
  { key: 'revenue', label: 'Receita', right: true, get: (r) => r.revenue, show: (r) => brl2(r.revenue) },
  { key: 'transactions', label: 'Transações', right: true, get: (r) => r.transactions, show: (r) => int(r.transactions) },
  { key: 'engagement', label: 'Engajamento', right: true, get: (r) => r.engagement, show: (r) => num1(r.engagement) },
  { key: 'convProb', label: 'Prob. conv.', right: true, get: (r) => r.convProb, show: (r) => pct(r.convProb * 100, 1) },
  { key: 'score', label: 'Score churn (ML)', right: true, get: (r) => r.scores[0], show: (r) => num2(r.scores[0]) },
  {
    key: 'churn', label: 'Churn real × previsto', get: (r) => r.churn,
    show: (r, thr) => {
      const p = r.scores[0] >= thr ? 1 : 0;
      const ok = p === r.churn;
      return (
        <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium ${ok ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'}`}>
          {r.churn ? 'Churn' : 'Retido'} → {p ? 'Churn' : 'Retido'}
        </span>
      );
    },
  },
];
const PAGE = 20;

export default function DataPage() {
  const { cur, threshold, period, segment, region } = useDash();
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'date', dir: -1 });
  const [page, setPage] = useState(0);

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    const f = t ? cur.filter((r) => r.customerId.toLowerCase().includes(t)) : cur;
    const col = COLS.find((c) => c.key === sort.key)!;
    return [...f].sort((a, b) => {
      const x = col.get(a), y = col.get(b);
      return (x < y ? -1 : x > y ? 1 : a.id - b.id) * sort.dir;
    });
  }, [cur, q, sort]);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const p = Math.min(page, pages - 1);
  const slice = rows.slice(p * PAGE, p * PAGE + PAGE);

  return (
    <Card
      title="Registros sintéticos"
      subtitle={`${int(rows.length)} de ${int(cur.length)} registros do período · dados fictícios gerados com semente 42`}
      actions={
        <>
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
            <input className="ctl !pl-8" placeholder="Buscar cliente (CLI-00001)" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} aria-label="Buscar cliente" />
          </div>
          <button className="btn btn-primary" onClick={() => downloadCsv(rows, threshold, `registros_${period}_${segment}_${region}`.replace(/\s/g, ''))}>
            <Download size={15} /> Exportar CSV
          </button>
        </>
      }
    >
      {!rows.length ? <Empty /> : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm" data-table>
              <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-500 dark:border-white/10 dark:text-slate-400">
                  {COLS.map((c) => (
                    <th key={c.key} className={`cursor-pointer select-none whitespace-nowrap px-2 py-2 font-medium hover:text-blue-500 ${c.right ? 'text-right' : 'text-left'}`}
                      onClick={() => setSort((s) => ({ key: c.key, dir: s.key === c.key ? (s.dir === 1 ? -1 : 1) : -1 }))}>
                      {c.label} {sort.key === c.key ? (sort.dir === 1 ? '▲' : '▼') : ''}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {slice.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50 dark:border-white/5 dark:hover:bg-white/[0.04]">
                    {COLS.map((c) => (
                      <td key={c.key} className={`whitespace-nowrap px-2 py-1.5 tabular-nums ${c.right ? 'text-right' : ''}`}>{c.show(r, threshold)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Página {p + 1} de {int(pages)}</span>
            <div className="flex gap-2">
              <button className="btn !px-2" disabled={p === 0} onClick={() => setPage(p - 1)} aria-label="Página anterior"><ChevronLeft size={15} /></button>
              <button className="btn !px-2" disabled={p >= pages - 1} onClick={() => setPage(p + 1)} aria-label="Próxima página"><ChevronRight size={15} /></button>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}
