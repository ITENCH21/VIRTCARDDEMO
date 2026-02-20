import { useNavigate } from 'react-router-dom';
import { useCards } from '../hooks/useCards';
import CardListItem from '../components/CardListItem';
import Spinner from '../components/Spinner';

export default function CardsPage() {
  const { cards, loading, error } = useCards();
  const navigate = useNavigate();

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

      {cards.map((card) => (
        <CardListItem key={card.id} card={card} />
      ))}
    </div>
  );
}
