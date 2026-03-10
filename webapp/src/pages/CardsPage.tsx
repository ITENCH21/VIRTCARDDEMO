import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCards } from '../hooks/useCards';
import CardListItem from '../components/CardListItem';
import FilterChips from '../components/FilterChips';
import Spinner from '../components/Spinner';

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
      <div className="flex-between mb-16">
        <h1 className="page-title" style={{ marginBottom: 0 }}>My Cards</h1>
        <button
          className="btn btn-primary"
          style={{ width: 'auto', padding: '8px 16px', fontSize: '14px' }}
          onClick={() => navigate('/cards/issue')}
        >
          + New Card
        </button>
      </div>

      {cards.length > 0 && (
        <div className="mb-16">
          <FilterChips
            options={CARD_STATUS_OPTIONS}
            value={statusFilter}
            onChange={setStatusFilter}
          />
        </div>
      )}

      {loading && <Spinner />}
      {error && <p className="error-text">{error}</p>}

      {!loading && cards.length === 0 && (
        <div className="text-center mt-24">
          <p className="text-hint">No cards yet</p>
          <button className="btn btn-primary mt-16" onClick={() => navigate('/cards/issue')}>
            Issue Your First Card
          </button>
        </div>
      )}

      {!loading && cards.length > 0 && filtered.length === 0 && (
        <p className="text-hint text-center mt-24">No cards with this status</p>
      )}

      {filtered.map((card) => (
        <CardListItem key={card.id} card={card} />
      ))}
    </div>
  );
}
