import { useState, useEffect, useCallback } from 'react';
import { fetchBalance, BalanceResponse } from '../api/balance';

export function useBalance() {
  const [data, setData] = useState<BalanceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchBalance();
      setData(res);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load balance');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, refresh: load };
}
