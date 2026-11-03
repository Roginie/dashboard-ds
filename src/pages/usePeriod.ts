import { useMemo } from 'react';
import { useDash } from '../context/DashboardContext';
import { bucketLabels, getRange, groupBuckets, periodDef } from '../data/aggregate';

/** Faixas, buckets e rótulos do período selecionado (e do anterior equivalente). */
export function usePeriod() {
  const { period, cur, prev } = useDash();
  return useMemo(() => {
    const def = periodDef(period);
    const range = getRange(period);
    const prange = getRange(period, true);
    return {
      def,
      range,
      prange,
      labels: bucketLabels(range, def.buckets),
      curB: groupBuckets(cur, range, def.buckets),
      prevB: groupBuckets(prev, prange, def.buckets),
    };
  }, [period, cur, prev]);
}
