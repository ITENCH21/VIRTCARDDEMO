import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchOperationStatus } from '../api/operations';

interface PollResult {
  status: string;
  isComplete: boolean;
  isFailed: boolean;
  isPolling: boolean;
}

/**
 * Polling hook for operation status.
 * - Every 3s for the first 30s
 * - Every 10s until 5 min
 * - Then stops
 */
export function usePolling(operationId: string | null): PollResult {
  const [status, setStatus] = useState('');
  const [isPolling, setIsPolling] = useState(false);
  const startTimeRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isComplete = status === 'C';
  const isFailed = status === 'F';

  const poll = useCallback(async () => {
    if (!operationId) return;

    try {
      const res = await fetchOperationStatus(operationId);
      setStatus(res.status);

      if (res.status === 'C' || res.status === 'F') {
        setIsPolling(false);
        return;
      }

      const elapsed = Date.now() - startTimeRef.current;
      if (elapsed > 5 * 60 * 1000) {
        setIsPolling(false);
        return;
      }

      const interval = elapsed < 30000 ? 3000 : 10000;
      timerRef.current = setTimeout(poll, interval);
    } catch {
      setIsPolling(false);
    }
  }, [operationId]);

  useEffect(() => {
    if (!operationId) return;

    startTimeRef.current = Date.now();
    setIsPolling(true);
    setStatus('P');
    poll();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [operationId, poll]);

  return { status, isComplete, isFailed, isPolling };
}
