import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCard } from '../hooks/useCards';
import AmountInput from '../components/AmountInput';
import ConfirmDialog from '../components/ConfirmDialog';
import Spinner from '../components/Spinner';
import { estimateTopup, topupCard, EstimateResponse } from '../api/cards';
import { usePolling } from '../hooks/usePolling';
import { formatAmount } from '../lib/format';
import { hapticFeedback } from '../lib/telegram';

export default function CardTopupPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { card, loading: cardLoading } = useCard(id!);
  const [amount, setAmount] = useState('');
  const [estimate, setEstimate] = useState<EstimateResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [operationId, setOperationId] = useState<string | null>(null);

  const { status, isComplete, isFailed, isPolling } = usePolling(operationId);

  const handleEstimate = async () => {
    if (!amount || parseFloat(amount) <= 0) return;
    setLoading(true);
    setError(null);
    try {
      const est = await estimateTopup(id!, amount);
      setEstimate(est);
      setShowConfirm(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Estimate failed');
    } finally {
      setLoading(false);
    }
  };

  const handleTopup = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await topupCard(id!, amount);
      setOperationId(res.operation_id);
      setShowConfirm(false);
      hapticFeedback('success');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Topup failed');
      hapticFeedback('error');
    } finally {
      setLoading(false);
    }
  };

  if (cardLoading) return <div className="page"><Spinner /></div>;

  if (operationId) {
    return (
      <div className="page text-center" style={{ paddingTop: '60px' }}>
        {isPolling && (
          <>
            <Spinner />
            <p className="mt-16">Processing topup...</p>
            <p className="text-hint">Status: {status}</p>
          </>
        )}
        {isComplete && (
          <>
            <h2 style={{ fontSize: '24px', color: 'var(--success-color)' }}>Topup Complete!</h2>
            <button className="btn btn-primary mt-24" onClick={() => navigate(`/cards/${id}`)}>
              Back to Card
            </button>
          </>
        )}
        {isFailed && (
          <>
            <h2 style={{ fontSize: '24px', color: 'var(--danger-color)' }}>Topup Failed</h2>
            <button className="btn btn-primary mt-24" onClick={() => { setOperationId(null); setError(null); }}>
              Try Again
            </button>
          </>
        )}
        {!isPolling && !isComplete && !isFailed && (
          <>
            <p className="text-hint">Check History for status.</p>
            <button className="btn btn-primary mt-16" onClick={() => navigate('/history')}>
              View History
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="page">
      <h1 className="page-title">Topup Card</h1>
      {card && (
        <p className="text-hint mb-16">
          {card.name} ****{card.last4} &middot; {formatAmount(card.balance, card.currency_symbol)}
        </p>
      )}

      <AmountInput value={amount} onChange={setAmount} />

      {error && <p className="error-text">{error}</p>}

      <button
        className="btn btn-primary mt-16"
        onClick={handleEstimate}
        disabled={loading || !amount || parseFloat(amount) <= 0}
      >
        {loading ? 'Calculating...' : 'Continue'}
      </button>

      <ConfirmDialog
        open={showConfirm}
        title="Confirm Topup"
        confirmLabel="Topup"
        onConfirm={handleTopup}
        onCancel={() => setShowConfirm(false)}
        loading={loading}
      >
        {estimate && (
          <div>
            <div className="flex-between mb-8">
              <span className="text-hint">Amount</span>
              <span>{formatAmount(estimate.amount, estimate.currency_symbol)}</span>
            </div>
            <div className="flex-between mb-8">
              <span className="text-hint">Fee</span>
              <span>{formatAmount(estimate.fee, estimate.currency_symbol)}</span>
            </div>
            <div className="flex-between" style={{ fontWeight: 700, borderTop: '1px solid var(--border-color)', paddingTop: '8px' }}>
              <span>Total</span>
              <span>{formatAmount(estimate.total, estimate.currency_symbol)}</span>
            </div>
          </div>
        )}
      </ConfirmDialog>
    </div>
  );
}
