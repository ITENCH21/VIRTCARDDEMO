import { useNavigate } from 'react-router-dom';
import { CardResponse } from '../api/cards';
import StatusBadge from './StatusBadge';
import { formatAmount } from '../lib/format';

interface Props {
  card: CardResponse;
}

export default function CardListItem({ card }: Props) {
  const navigate = useNavigate();

  return (
    <div
      className="card"
      onClick={() => navigate(`/cards/${card.id}`)}
      style={{ cursor: 'pointer' }}
    >
      <div className="flex-between">
        <div>
          <div style={{ fontWeight: 600, fontSize: '16px' }}>
            {card.name} ****{card.last4}
          </div>
          <div className="text-hint mt-8">
            {formatAmount(card.balance, card.currency_symbol)}
          </div>
        </div>
        <StatusBadge status={card.status} label={card.status === 'P' ? 'Closing' : undefined} />
      </div>
    </div>
  );
}
