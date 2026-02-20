import { useState, useEffect, useCallback } from 'react';
import { fetchCards, fetchCard, CardResponse } from '../api/cards';

export function useCards() {
  const [cards, setCards] = useState<CardResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchCards();
      setCards(res);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load cards');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { cards, loading, error, refresh: load };
}

export function useCard(id: string) {
  const [card, setCard] = useState<CardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchCard(id);
      setCard(res);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load card');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  return { card, loading, error, refresh: load };
}
