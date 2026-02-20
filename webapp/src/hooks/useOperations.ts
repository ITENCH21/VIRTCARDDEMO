import { useState, useEffect, useCallback } from 'react';
import { fetchOperations, OperationResponse } from '../api/operations';

export function useOperations(pageSize = 10) {
  const [items, setItems] = useState<OperationResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (newOffset: number) => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchOperations(newOffset, pageSize);
      setItems(res.items);
      setTotal(res.total);
      setOffset(newOffset);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load operations');
    } finally {
      setLoading(false);
    }
  }, [pageSize]);

  useEffect(() => {
    load(0);
  }, [load]);

  const nextPage = useCallback(() => {
    if (offset + pageSize < total) {
      load(offset + pageSize);
    }
  }, [offset, pageSize, total, load]);

  const prevPage = useCallback(() => {
    if (offset > 0) {
      load(Math.max(0, offset - pageSize));
    }
  }, [offset, pageSize, load]);

  return {
    items,
    total,
    offset,
    loading,
    error,
    nextPage,
    prevPage,
    hasNext: offset + pageSize < total,
    hasPrev: offset > 0,
    refresh: () => load(offset),
  };
}
