import { useState, useEffect, useCallback, useMemo } from 'react';
import { fetchOperations, OperationResponse, OperationFilters } from '../api/operations';

export type Period = 'today' | 'yesterday' | 'week' | 'month' | 'all';

function getDateRange(period: Period): { from: Date | null; to: Date | null } {
  const now = new Date();
  const startOfDay = (d: Date) => { const r = new Date(d); r.setHours(0, 0, 0, 0); return r; };

  switch (period) {
    case 'today':
      return { from: startOfDay(now), to: null };
    case 'yesterday': {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      return { from: startOfDay(y), to: startOfDay(now) };
    }
    case 'week': {
      const w = new Date(now);
      w.setDate(w.getDate() - 7);
      return { from: startOfDay(w), to: null };
    }
    case 'month': {
      const m = new Date(now);
      m.setDate(m.getDate() - 30);
      return { from: startOfDay(m), to: null };
    }
    case 'all':
    default:
      return { from: null, to: null };
  }
}

export function useOperations(pageSize = 15) {
  const [allItems, setAllItems] = useState<OperationResponse[]>([]);
  const [totalFromApi, setTotalFromApi] = useState(0);
  const [page, setPage] = useState(0);
  const [filters, setFilters] = useState<OperationFilters>({});
  const [period, setPeriod] = useState<Period>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch large batch from API (kind/status filtered server-side)
  const load = useCallback(async (f?: OperationFilters) => {
    const activeFilters = f ?? filters;
    try {
      setLoading(true);
      setError(null);
      const res = await fetchOperations(0, 50, activeFilters);
      setAllItems(res.items);
      setTotalFromApi(res.total);
      setPage(0);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(typeof msg === 'string' ? msg : 'Failed to load operations');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  // Client-side date filtering
  const dateFiltered = useMemo(() => {
    if (period === 'all') return allItems;
    const { from, to } = getDateRange(period);
    return allItems.filter((op) => {
      const d = new Date(op.created_at);
      if (from && d < from) return false;
      if (to && d >= to) return false;
      return true;
    });
  }, [allItems, period]);

  // Paginated slice
  const offset = page * pageSize;
  const items = dateFiltered.slice(offset, offset + pageSize);
  const total = dateFiltered.length;
  const hasNext = offset + pageSize < total;
  const hasPrev = page > 0;

  const nextPage = useCallback(() => {
    if (offset + pageSize < total) setPage((p) => p + 1);
  }, [offset, pageSize, total]);

  const prevPage = useCallback(() => {
    if (page > 0) setPage((p) => p - 1);
  }, [page]);

  const applyFilters = useCallback((newFilters: OperationFilters) => {
    setFilters(newFilters);
    setPeriod((p) => p); // keep period
    load(newFilters);
  }, [load]);

  const applyPeriod = useCallback((newPeriod: Period) => {
    setPeriod(newPeriod);
    setPage(0);
  }, []);

  return {
    items,
    total,
    offset,
    loading,
    error,
    filters,
    period,
    nextPage,
    prevPage,
    hasNext,
    hasPrev,
    refresh: () => load(),
    applyFilters,
    applyPeriod,
    // All filtered items (for computing stats)
    allFiltered: dateFiltered,
    totalFromApi,
  };
}
