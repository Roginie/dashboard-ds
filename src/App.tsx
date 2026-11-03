import { useEffect, useState } from 'react';
import { DashboardProvider, useDash } from './context/DashboardContext';
import { Layout, PAGES, PageId } from './components/Layout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Skeleton } from './components/ui';
import Executive from './pages/Executive';
import Analysis from './pages/Analysis';
import ML from './pages/ML';
import DataPage from './pages/DataPage';

const readPage = (): PageId => {
  const id = location.hash.replace('#/', '') as PageId;
  return PAGES.some((p) => p.id === id) ? id : 'executivo';
};

function Body() {
  const [page, setPage] = useState<PageId>(readPage);
  const { loading, error } = useDash();
  useEffect(() => {
    const f = () => {
      setPage(readPage());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);

  return (
    <Layout page={page}>
      {error ? (
        <div className="card p-6 text-rose-500">Falha ao gerar a base de dados: {error}</div>
      ) : loading ? (
        <div data-loading className="space-y-4">
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-6">
            {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-32" />)}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Skeleton className="h-80" />
            <Skeleton className="h-80" />
          </div>
          <p className="text-center text-sm text-slate-400">Gerando 20.000 registros sintéticos…</p>
        </div>
      ) : (
        <ErrorBoundary key={page}>
          {page === 'executivo' && <Executive />}
          {page === 'analise' && <Analysis />}
          {page === 'ml' && <ML />}
          {page === 'dados' && <DataPage />}
        </ErrorBoundary>
      )}
    </Layout>
  );
}

export default function App() {
  return (
    <DashboardProvider>
      <Body />
    </DashboardProvider>
  );
}
