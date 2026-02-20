import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useBalance } from '../hooks/useBalance';
import Spinner from '../components/Spinner';
import { formatAmount } from '../lib/format';

export default function DashboardPage() {
  const { client } = useAuth();
  const { data, loading, error } = useBalance();
  const navigate = useNavigate();

  return (
    <div className="page">
      <h1 className="page-title">
        {client?.name ? `Hi, ${client.name.split(' ')[0]}` : 'Dashboard'}
      </h1>

      {loading && <Spinner />}
      {error && <p className="error-text">{error}</p>}

      {data && (
        <>
          <div className="card" style={{ textAlign: 'center', padding: '24px' }}>
            <div className="text-hint" style={{ fontSize: '14px' }}>Balance</div>
            {data.accounts.map((acc) => (
              <div key={acc.id} style={{ marginTop: '8px' }}>
                <div style={{ fontSize: '28px', fontWeight: 700 }}>
                  {formatAmount(acc.available, acc.currency_symbol)}
                </div>
                {acc.balance !== acc.available && (
                  <div className="text-hint" style={{ fontSize: '12px' }}>
                    Total: {formatAmount(acc.balance, acc.currency_symbol)}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }} className="mt-16">
            <button className="btn btn-primary" onClick={() => navigate('/deposit')}>
              Deposit
            </button>
            <button className="btn btn-primary" onClick={() => navigate('/withdraw')}>
              Withdraw
            </button>
            <button className="btn btn-primary" onClick={() => navigate('/cards/issue')}>
              New Card
            </button>
            <button className="btn btn-secondary" onClick={() => navigate('/cards')}>
              My Cards
            </button>
            <button className="btn btn-secondary" onClick={() => navigate('/history')}>
              History
            </button>
          </div>
        </>
      )}
    </div>
  );
}
