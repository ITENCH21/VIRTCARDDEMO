import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCards } from '../hooks/useCards';
import VirtualCard from '../components/VirtualCard';
import FilterChips from '../components/FilterChips';
import Spinner from '../components/Spinner';
import { PlusIcon } from '../components/icons';
import { formatAmount } from '../lib/format';
import { useLang } from '../contexts/LangContext';

const ACTIVE_STATUSES = new Set(['A', 'R']);

export default function CardsPage() {
  const { cards, loading, error } = useCards();
  const navigate = useNavigate();
  const { t, lang } = useLang();
  const [statusFilter, setStatusFilter] = useState('');

  const CARD_STATUS_OPTIONS = [
    { value: 'active', label: t('filter_active') },
    { value: 'L', label: t('filter_frozen') },
    { value: 'C', label: t('filter_closed') },
    { value: 'P', label: t('filter_closing') },
  ];

  const filtered = useMemo(() => {
    if (!statusFilter) return cards;
    if (statusFilter === 'active') return cards.filter((c) => ACTIVE_STATUSES.has(c.status));
    return cards.filter((c) => c.status === statusFilter);
  }, [cards, statusFilter]);

  return (
    <div className="page">
      {/* Header with filter + action */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 16, marginBottom: 20, flexWrap: 'wrap',
      }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          {cards.length > 0 && (
            <FilterChips
              options={CARD_STATUS_OPTIONS}
              value={statusFilter}
              onChange={setStatusFilter}
            />
          )}
        </div>
        {cards.length > 0 && (
          <button
            className="btn btn-primary"
            style={{ width: 'auto', padding: '12px 24px' }}
            onClick={() => navigate('/cards/issue')}
          >
            <PlusIcon size={18} />
            {t('issue_new_card')}
          </button>
        )}
      </div>

      {loading && <Spinner />}
      {error && <p className="error-text">{error}</p>}

      {/* Empty state */}
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
            {t('no_cards')}
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6, marginBottom: 28, maxWidth: 320, margin: '0 auto 28px' }}>
            {t('no_cards_desc')}
          </p>
          <button className="btn btn-primary" style={{ maxWidth: 300, margin: '0 auto' }} onClick={() => navigate('/cards/issue')}>
            <PlusIcon size={18} />
            {t('issue_first_card')}
          </button>
        </div>
      )}

      {/* No results for filter */}
      {!loading && cards.length > 0 && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: 15 }}>
          {t('no_cards_status')}
        </div>
      )}

      {/* Cards Grid */}
      {filtered.length > 0 && (
        <div className="cards-grid">
          {filtered.map((card) => (
            <VirtualCard
              key={card.id}
              name={card.name}
              last4={card.last4}
              balance={formatAmount(card.balance, card.currency_symbol)}
              currencySymbol=""
              currencyCode={card.currency_code}
              status={card.status}
              onClick={() => navigate(`/cards/${card.id}`)}
            />
          ))}
        </div>
      )}
      {/* Whitelist hint */}
      {cards.length > 0 && (
        <div className="glass-card" style={{
          padding: '14px 18px', marginTop: 24,
          borderLeft: '3px solid var(--accent-1)',
        }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="var(--accent-1)" strokeWidth="2" width="16" height="16" style={{ flexShrink: 0, marginTop: 1 }}>
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
              {lang === 'ru'
                ? 'USD-карты работают по вайт-листу (180+ сервисов). EUR-карты — без ограничений, включая офлайн-магазины и такси.'
                : 'USD cards work via whitelist (180+ services). EUR cards — no restrictions, including offline stores and taxi.'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
