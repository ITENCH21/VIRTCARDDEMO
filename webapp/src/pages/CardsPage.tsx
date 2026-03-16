import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCards } from '../hooks/useCards';
import CardListItem from '../components/CardListItem';
import FilterChips from '../components/FilterChips';
import Spinner from '../components/Spinner';
import { PlusIcon } from '../components/icons';

const CARD_STATUS_OPTIONS = [
  { value: 'active', label: 'Активные' },
  { value: 'L', label: 'Заблокированные' },
  { value: 'C', label: 'Закрытые' },
  { value: 'P', label: 'Закрываются' },
];

const ACTIVE_STATUSES = new Set(['A', 'R']);

export default function CardsPage() {
  const { cards, loading, error } = useCards();
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState('');

  const filtered = useMemo(() => {
    if (!statusFilter) return cards;
    if (statusFilter === 'active') return cards.filter((c) => ACTIVE_STATUSES.has(c.status));
    return cards.filter((c) => c.status === statusFilter);
  }, [cards, statusFilter]);

  return (
    <div className="page">
      <div style={{ height: 8 }} />

      {cards.length > 0 && (
        <div style={{ marginBottom: 16 }}>
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
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{
            width: 72, height: 72, borderRadius: 20,
            background: 'var(--accent-gradient)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px',
            boxShadow: '0 8px 24px rgba(59,130,246,0.35)',
          }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" width="32" height="32">
              <rect x="1" y="4" width="22" height="16" rx="2" />
              <line x1="1" y1="10" x2="23" y2="10" />
            </svg>
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
            Карт пока нет
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6, marginBottom: 28, maxWidth: 260, margin: '0 auto 28px' }}>
            Выпустите виртуальную карту для онлайн-платежей
          </p>
          <button className="btn btn-primary" onClick={() => navigate('/cards/issue')}>
            <PlusIcon size={18} />
            Выпустить первую карту
          </button>
        </div>
      )}

      {!loading && cards.length > 0 && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: 15 }}>
          Нет карт с таким статусом
        </div>
      )}

      {filtered.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map((card) => (
            <CardListItem key={card.id} card={card} />
          ))}
        </div>
      )}

      {cards.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <button className="btn btn-primary" onClick={() => navigate('/cards/issue')}>
            <PlusIcon size={18} />
            Выпустить новую карту
          </button>
        </div>
      )}
    </div>
  );
}
