import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import AmountInput from '../components/AmountInput';
import ConfirmDialog from '../components/ConfirmDialog';
import Spinner from '../components/Spinner';
import { estimateIssue, issueCard, syncOperation, fetchIssueLimits, EstimateResponse, AmountLimitsResponse, CardCurrency, CardType } from '../api/cards';
import { usePolling } from '../hooks/usePolling';
import { formatAmount } from '../lib/format';
import { hapticFeedback } from '../lib/telegram';

export default function CardIssuePage() {
  const navigate = useNavigate();
  const [amount, setAmount] = useState('');
  const [cardName, setCardName] = useState('');
  const [cardCurrency, setCardCurrency] = useState<CardCurrency>('USD');
  const [cardType, setCardType] = useState<CardType>('standard');
  const [estimate, setEstimate] = useState<EstimateResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [operationId, setOperationId] = useState<string | null>(null);
  const [limits, setLimits] = useState<AmountLimitsResponse | null>(null);

  const { status, isComplete, isFailed, isPolling } = usePolling(operationId);

  useEffect(() => {
    fetchIssueLimits()
      .then(setLimits)
      .catch(() => {});
  }, []);

  const isAmountInvalid = useMemo(() => {
    if (!limits || !amount) return false;
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) return false;
    if (limits.min_amount !== null && num < parseFloat(limits.min_amount)) return true;
    if (limits.max_amount !== null && num > parseFloat(limits.max_amount)) return true;
    return false;
  }, [amount, limits]);

  const limitsHint = useMemo(() => {
    if (!limits) return undefined;
    const parts: string[] = [];
    if (limits.min_amount !== null) parts.push(`Min: ${limits.min_amount}`);
    if (limits.max_amount !== null) parts.push(`Max: ${limits.max_amount}`);
    if (parts.length === 0) return undefined;
    return parts.join(' — ') + ` ${limits.currency_symbol}`;
  }, [limits]);

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
      const res = await issueCard(amount, cardName, cardCurrency, cardType);
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

  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const handleSync = async () => {
    if (!operationId) return;
    setSyncing(true);
    setSyncMessage(null);
    try {
      const res = await syncOperation(operationId);
      setSyncMessage(res.message);
      if (res.synced) {
        hapticFeedback('success');
      }
    } catch (e: unknown) {
      setSyncMessage(e instanceof Error ? e.message : 'Sync failed');
      hapticFeedback('error');
    } finally {
      setSyncing(false);
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
            <p className="text-hint">Polling timed out.</p>
            <button
              className="btn btn-primary mt-16"
              onClick={handleSync}
              disabled={syncing}
            >
              {syncing ? 'Syncing...' : 'Sync from VC API'}
            </button>
            {syncMessage && <p className="text-hint mt-8">{syncMessage}</p>}
            <button className="btn mt-16" style={{ background: 'var(--secondary-bg-color)', color: 'var(--text-color)' }} onClick={() => navigate('/history')}>
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

      <div className="input-group">
        <label>Currency</label>
        <select
          value={cardCurrency}
          onChange={(e) => setCardCurrency(e.target.value as CardCurrency)}
          style={{
            width: '100%',
            padding: '12px',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            fontSize: '16px',
            background: 'var(--bg-color)',
            color: 'var(--text-color)',
          }}
        >
          <option value="USD">USD</option>
          <option value="EUR">EUR</option>
        </select>
      </div>

      <div className="input-group">
        <label>Card Type</label>
        <select
          value={cardType}
          onChange={(e) => setCardType(e.target.value as CardType)}
          style={{
            width: '100%',
            padding: '12px',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            fontSize: '16px',
            background: 'var(--bg-color)',
            color: 'var(--text-color)',
          }}
        >
          <option value="standard">Standard</option>
          <option value="wallet">Wallet</option>
        </select>
      </div>

      <AmountInput
        value={amount}
        onChange={setAmount}
        label="Initial Amount"
        error={isAmountInvalid}
        hint={limitsHint}
      />

      {error && <p className="error-text">{error}</p>}

      <button
        className="btn btn-primary mt-16"
        onClick={handleEstimate}
        disabled={loading || !amount || parseFloat(amount) <= 0 || isAmountInvalid}
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
