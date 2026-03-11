import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCards } from '../hooks/useCards';
import CardListItem from '../components/CardListItem';
import FilterChips from '../components/FilterChips';
import Spinner from '../components/Spinner';
import { PlusIcon } from '../components/icons';

const CARD_STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'L', label: 'Blocked' },
  { value: 'C', label: 'Closed' },
  { value: 'P', label: 'Closing' },
];

const ACTIVE_STATUSES = new Set(['A', 'R']);

export default function CardsPage() {
  const { cards, loading, error } = useCards();
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState('');

  const filtered = useMemo(() => {
    if (!statusFilter) return cards;
    if (statusFilter === 'active') {
      return cards.filter((c) => ACTIVE_STATUSES.has(c.status));
    }
    return cards.filter((c) => c.status === statusFilter);
  }, [cards, statusFilter]);

  return (
    <div className="page">
      <div style={{ height: 16 }} />

      {cards.length > 0 && (
        <FilterChips
          options={CARD_STATUS_OPTIONS}
          value={statusFilter}
          onChange={setStatusFilter}
        />
      )}

      {loading && <Spinner />}
      {error && <p className="error-text">{error}</p>}

      {!loading && cards.length === 0 && (
        <div className="text-center mt-24">
          <p style={{ color: 'var(--text-secondary)', fontSize: 15 }}>No cards yet</p>
          <button className="btn btn-primary mt-16" onClick={() => navigate('/cards/issue')}>
            <PlusIcon size={18} />
            Issue Your First Card
          </button>
        </div>
      )}

      {!loading && cards.length > 0 && filtered.length === 0 && (
        <p style={{ color: 'var(--text-secondary)', textAlign: 'center', marginTop: 24 }}>No cards with this status</p>
      )}

      {filtered.map((card) => (
        <CardListItem key={card.id} card={card} />
      ))}

      {cards.length > 0 && (
        <>
          <div style={{ height: 24 }} />
          <button className="btn btn-primary" onClick={() => navigate('/cards/issue')}>
            <PlusIcon size={18} />
            Issue New Card
          </button>
        </>
      )}
    </div>
  );
}
