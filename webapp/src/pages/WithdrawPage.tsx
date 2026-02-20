import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AmountInput from '../components/AmountInput';
import ConfirmDialog from '../components/ConfirmDialog';
import { estimateWithdraw, createWithdraw, WithdrawEstimateResponse } from '../api/withdraw';
import { formatAmount } from '../lib/format';
import { hapticFeedback } from '../lib/telegram';

const TRC20_RE = /^T[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]{33}$/;

function isValidTrc20(addr: string): boolean {
  return TRC20_RE.test(addr.trim());
}

function formatTarif(est: WithdrawEstimateResponse): string {
  const parts: string[] = [];
  if (est.fee_percent !== '0') parts.push(`${est.fee_percent}%`);
  if (est.fee_fixed !== '0') parts.push(`+ ${est.fee_fixed} ${est.currency_symbol} fix`);
  if (est.fee_minimal !== '0') parts.push(`min ${est.fee_minimal} ${est.currency_symbol}`);
  return parts.join(', ') || 'Free';
}

export default function WithdrawPage() {
  const navigate = useNavigate();
  const [amount, setAmount] = useState('');
  const [address, setAddress] = useState('');
  const [estimate, setEstimate] = useState<WithdrawEstimateResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [addressError, setAddressError] = useState<string | null>(null);

  const handleEstimate = async () => {
    if (!amount || parseFloat(amount) <= 0) return;
    const trimmed = address.trim();
    if (!trimmed) {
      setAddressError('Enter USDT TRC-20 address');
      return;
    }
    if (!isValidTrc20(trimmed)) {
      setAddressError('Invalid TRC-20 address format');
      return;
    }
    setAddressError(null);
    setLoading(true);
    setError(null);
    try {
      const est = await estimateWithdraw(amount);
      setEstimate(est);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Estimate failed');
    } finally {
      setLoading(false);
    }
  };

  const handleAmountChange = (val: string) => {
    setAmount(val);
    setEstimate(null);
  };

  const handleWithdraw = async () => {
    setLoading(true);
    setError(null);
    try {
      await createWithdraw(amount, address.trim());
      setShowConfirm(false);
      setSubmitted(true);
      hapticFeedback('success');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Withdrawal failed');
      hapticFeedback('error');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="page text-center" style={{ paddingTop: '60px' }}>
        <h2 style={{ fontSize: '24px', color: 'var(--success-color)' }}>Withdrawal Submitted!</h2>
        <p className="text-hint mt-8">Your request is being processed. You will be notified when it's complete.</p>
        <button className="btn btn-primary mt-24" onClick={() => navigate('/history')}>
          View History
        </button>
        <button className="btn btn-secondary mt-8" onClick={() => navigate('/')}>
          Home
        </button>
      </div>
    );
  }

  return (
    <div className="page">
      <h1 className="page-title">Withdraw USDT</h1>

      <AmountInput value={amount} onChange={handleAmountChange} label="Amount" />

      <div className="input-group">
        <label>USDT TRC-20 Address</label>
        <input
          type="text"
          value={address}
          onChange={(e) => { setAddress(e.target.value); setAddressError(null); setEstimate(null); }}
          placeholder="T..."
        />
        {addressError && <p className="error-text" style={{ marginTop: '4px' }}>{addressError}</p>}
      </div>

      {estimate && (
        <div className="card mt-16" style={{ padding: '12px 16px' }}>
          <div className="flex-between mb-8">
            <span className="text-hint">Commission</span>
            <span className="text-hint">{formatTarif(estimate)}</span>
          </div>
          <div className="flex-between mb-8">
            <span className="text-hint">Fee</span>
            <span>{formatAmount(estimate.fee, estimate.currency_symbol)}</span>
          </div>
          <div className="flex-between" style={{ fontWeight: 700 }}>
            <span>Total</span>
            <span>{formatAmount(estimate.total, estimate.currency_symbol)}</span>
          </div>
        </div>
      )}

      {error && <p className="error-text">{error}</p>}

      {!estimate ? (
        <button
          className="btn btn-primary mt-16"
          onClick={handleEstimate}
          disabled={loading || !amount || parseFloat(amount) <= 0 || !address.trim()}
        >
          {loading ? 'Calculating...' : 'Continue'}
        </button>
      ) : (
        <button
          className="btn btn-primary mt-16"
          onClick={() => setShowConfirm(true)}
          disabled={loading}
        >
          Withdraw
        </button>
      )}

      <ConfirmDialog
        open={showConfirm}
        title="Confirm Withdrawal"
        confirmLabel="Withdraw"
        onConfirm={handleWithdraw}
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
              <span className="text-hint">Fee ({formatTarif(estimate)})</span>
              <span>{formatAmount(estimate.fee, estimate.currency_symbol)}</span>
            </div>
            <div className="flex-between mb-8" style={{ fontWeight: 700, borderTop: '1px solid var(--border-color)', paddingTop: '8px' }}>
              <span>Total</span>
              <span>{formatAmount(estimate.total, estimate.currency_symbol)}</span>
            </div>
            <div className="flex-between mt-8">
              <span className="text-hint">Address</span>
              <span style={{ fontSize: '12px', wordBreak: 'break-all', maxWidth: '60%', textAlign: 'right' }}>{address}</span>
            </div>
          </div>
        )}
      </ConfirmDialog>
    </div>
  );
}
