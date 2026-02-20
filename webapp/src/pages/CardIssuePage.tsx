import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AmountInput from '../components/AmountInput';
import ConfirmDialog from '../components/ConfirmDialog';
import Spinner from '../components/Spinner';
import { estimateIssue, issueCard, EstimateResponse } from '../api/cards';
import { usePolling } from '../hooks/usePolling';
import { formatAmount } from '../lib/format';
import { hapticFeedback } from '../lib/telegram';

export default function CardIssuePage() {
  const navigate = useNavigate();
  const [amount, setAmount] = useState('');
  const [cardName, setCardName] = useState('');
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
      const est = await estimateIssue(amount);
      setEstimate(est);
      setShowConfirm(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Estimate failed');
    } finally {
      setLoading(false);
    }
  };

  const handleIssue = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await issueCard(amount, cardName);
      setOperationId(res.operation_id);
      setShowConfirm(false);
      hapticFeedback('success');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Issue failed');
      hapticFeedback('error');
    } finally {
      setLoading(false);
    }
  };

  if (operationId) {
    return (
      <div className="page text-center" style={{ paddingTop: '60px' }}>
        {isPolling && (
          <>
            <Spinner />
            <p className="mt-16">Processing your card...</p>
            <p className="text-hint">Status: {status}</p>
          </>
        )}
        {isComplete && (
          <>
            <h2 style={{ fontSize: '24px', color: 'var(--success-color)' }}>Card Issued!</h2>
            <p className="text-hint mt-8">Your new card is ready</p>
            <button className="btn btn-primary mt-24" onClick={() => navigate('/cards')}>
              View Cards
            </button>
          </>
        )}
        {isFailed && (
          <>
            <h2 style={{ fontSize: '24px', color: 'var(--danger-color)' }}>Failed</h2>
            <p className="text-hint mt-8">Card issuance failed. Please try again.</p>
            <button className="btn btn-primary mt-24" onClick={() => { setOperationId(null); setError(null); }}>
              Try Again
            </button>
          </>
        )}
        {!isPolling && !isComplete && !isFailed && (
          <>
            <p className="text-hint">Polling timed out. Check History for status.</p>
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
      <h1 className="page-title">Issue New Card</h1>

      <div className="input-group">
        <label>Card Name (optional)</label>
        <input
          type="text"
          value={cardName}
          onChange={(e) => setCardName(e.target.value)}
          placeholder="My Card"
        />
      </div>

      <AmountInput value={amount} onChange={setAmount} label="Initial Amount" />

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
        title="Confirm Card Issue"
        confirmLabel="Issue Card"
        onConfirm={handleIssue}
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
