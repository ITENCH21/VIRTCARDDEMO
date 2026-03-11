import { useNavigate } from 'react-router-dom';
import { CardResponse } from '../api/cards';
import StatusBadge from './StatusBadge';
import { CreditCardIcon } from './icons';
import { formatAmount } from '../lib/format';

interface Props {
  card: CardResponse;
}

function getStatusStyle(status: string) {
  if (status === 'A' || status === 'R') return { bg: 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(16,185,129,0.05))', color: '#10b981' };
  if (status === 'L' || status === 'B') return { bg: 'linear-gradient(135deg, rgba(239,68,68,0.15), rgba(239,68,68,0.05))', color: '#ef4444' };
  return { bg: 'linear-gradient(135deg, rgba(100,116,139,0.15), rgba(100,116,139,0.05))', color: '#64748b' };
}

export default function CardListItem({ card }: Props) {
  const navigate = useNavigate();
  const st = getStatusStyle(card.status);

  return (
    <div
      onClick={() => navigate(`/cards/${card.id}`)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: 16,
        background: 'var(--bg-glass)',
        border: '1px solid var(--border-glass)',
        borderRadius: 'var(--radius-md)',
        marginBottom: 10,
        cursor: 'pointer',
        transition: 'var(--transition-normal)',
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          background: st.bg,
          color: st.color,
        }}
      >
        <CreditCardIcon size={20} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {card.name || 'Card'}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
          ****{card.last4} &bull; {card.currency_code}
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
          {formatAmount(card.balance, card.currency_symbol)}
        </div>
        <div style={{ marginTop: 4 }}>
          <StatusBadge status={card.status} label={card.status === 'P' ? 'Closing' : undefined} />
        </div>
      </div>
    </div>
  );
}
