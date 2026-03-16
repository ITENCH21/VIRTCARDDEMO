import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import AmountInput from '../components/AmountInput';
import ConfirmDialog from '../components/ConfirmDialog';
import PollingScreen from '../components/PollingScreen';
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

  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

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
      hapticFeedback('notification');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Issue failed');
      hapticFeedback('notification');
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    if (!operationId) return;
    setSyncing(true);
    setSyncMessage(null);
    try {
      const res = await syncOperation(operationId);
      setSyncMessage(res.message);
      if (res.synced) hapticFeedback('notification');
    } catch (e: unknown) {
      setSyncMessage(e instanceof Error ? e.message : 'Sync failed');
      hapticFeedback('notification');
    } finally {
      setSyncing(false);
    }
  };

  const timedOut = !isPolling && !isComplete && !isFailed && !!operationId;

  if (operationId) {
    return (
      <div className="page" style={{ paddingTop: 40 }}>
        <PollingScreen
          isPolling={isPolling}
          isComplete={isComplete}
          isFailed={isFailed}
          timedOut={timedOut}
          onSync={handleSync}
          syncing={syncing}
          syncMessage={syncMessage ?? undefined}
        />
        {isPolling && (
          <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            Status: {status}
          </p>
        )}
        {isComplete && (
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 15, color: 'var(--text-secondary)', margin: '8px 0 20px' }}>Your new card is ready</p>
            <button className="btn btn-primary" onClick={() => navigate('/cards')}>
              View Cards
            </button>
          </div>
        )}
        {isFailed && (
          <div style={{ textAlign: 'center' }}>
            <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={() => { setOperationId(null); setError(null); }}>
              Try Again
            </button>
          </div>
        )}
        {timedOut && (
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <button className="btn btn-secondary" onClick={() => navigate('/history')}>
              View History
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="page">
      <h1 className="page-title">Issue New Card</h1>

      {/* Card Name */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 8 }}>
          Card Name (optional)
        </label>
        <input
          type="text"
          value={cardName}
          onChange={(e) => setCardName(e.target.value)}
          placeholder="My Card"
          className="form-input"
        />
      </div>

      {/* Currency */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 8 }}>
          Currency
        </label>
        <select
          value={cardCurrency}
          onChange={(e) => setCardCurrency(e.target.value as CardCurrency)}
          className="form-select"
        >
          <option value="USD">USD</option>
          <option value="EUR">EUR</option>
        </select>
      </div>

      {/* Card Type */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 8 }}>
          Card Type
        </label>
        <select
          value={cardType}
          onChange={(e) => setCardType(e.target.value as CardType)}
          className="form-select"
        >
          <option value="standard">Standard</option>
          <option value="wallet">Wallet</option>
        </select>
      </div>

      {/* Amount with Presets */}
      <AmountInput
        value={amount}
        onChange={setAmount}
        label="Initial Amount"
        error={isAmountInvalid}
        hint={limitsHint}
        presets={[50, 100, 150, 200, 300, 500]}
      />

      {error && <p className="error-text">{error}</p>}

      <button
        className="btn btn-primary"
        onClick={handleEstimate}
        disabled={loading || !amount || parseFloat(amount) <= 0 || isAmountInvalid}
        style={{ marginTop: 8 }}
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
            <div className="info-row">
              <span style={{ color: 'var(--text-secondary)' }}>Amount</span>
              <span style={{ fontWeight: 600 }}>{formatAmount(estimate.amount, estimate.currency_symbol)}</span>
            </div>
            <div className="info-row">
              <span style={{ color: 'var(--text-secondary)' }}>Fee</span>
              <span style={{ fontWeight: 600 }}>{formatAmount(estimate.fee, estimate.currency_symbol)}</span>
            </div>
            <div className="info-row" style={{ borderTop: '1px solid var(--border-glass)', paddingTop: 12, marginTop: 4 }}>
              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Total</span>
              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{formatAmount(estimate.total, estimate.currency_symbol)}</span>
            </div>
          </div>
        )}
      </ConfirmDialog>
    </div>
  );
}
