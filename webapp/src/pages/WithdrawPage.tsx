import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AmountInput from '../components/AmountInput';
import ConfirmDialog from '../components/ConfirmDialog';
import { useBalance } from '../hooks/useBalance';
import { estimateWithdraw, createWithdraw, WithdrawEstimateResponse } from '../api/withdraw';
import { formatAmount } from '../lib/format';
import { hapticFeedback } from '../lib/telegram';
import { CheckIcon } from '../components/icons';

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
  const { data: balanceData } = useBalance();
  const mainAccount = balanceData?.accounts?.[0];
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
      <div className="page" style={{ paddingTop: 60, textAlign: 'center' }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%', margin: '0 auto 20px',
          background: 'rgba(16,185,129,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--success)',
        }}>
          <CheckIcon size={28} />
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>Withdrawal Submitted!</h2>
        <p style={{ color: 'var(--text-secondary)', marginTop: 8, lineHeight: 1.5 }}>
          Your request is being processed. You will be notified when it's complete.
        </p>
        <button className="btn btn-primary" style={{ marginTop: 24 }} onClick={() => navigate('/history')}>
          View History
        </button>
        <button className="btn btn-secondary" style={{ marginTop: 10 }} onClick={() => navigate('/')}>
          Home
        </button>
      </div>
    );
  }

  return (
    <div className="page">
      <h1 className="page-title">Withdraw USDT</h1>

      {/* Available Balance */}
      {mainAccount && (
        <div className="glass-card" style={{ padding: '16px 20px', marginBottom: 20, textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Available Balance</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', marginTop: 4 }}>
            {formatAmount(mainAccount.available, mainAccount.currency_symbol)}
          </div>
        </div>
      )}

      {/* Amount */}
      <AmountInput
        value={amount}
        onChange={handleAmountChange}
        label="Amount"
        presets={[50, 100, 200, 500, 1000]}
      />

      {/* Address */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 8 }}>
          USDT TRC-20 Address
        </label>
        <input
          type="text"
          value={address}
          onChange={(e) => { setAddress(e.target.value); setAddressError(null); setEstimate(null); }}
          placeholder="T..."
          className="form-input"
          style={{
            borderColor: addressError ? 'var(--danger)' : undefined,
          }}
        />
        {addressError && <p className="error-text" style={{ marginTop: 4 }}>{addressError}</p>}
      </div>

      {/* Fee Breakdown */}
      {estimate && (
        <div className="glass-card" style={{ padding: '16px 20px', marginBottom: 16 }}>
          <div className="info-row">
            <span style={{ color: 'var(--text-muted)' }}>Commission</span>
            <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{formatTarif(estimate)}</span>
          </div>
          <div className="info-row">
            <span style={{ color: 'var(--text-muted)' }}>Fee</span>
            <span style={{ fontWeight: 600 }}>{formatAmount(estimate.fee, estimate.currency_symbol)}</span>
          </div>
          <div className="info-row" style={{ borderTop: '1px solid var(--border-glass)', paddingTop: 10, marginTop: 4 }}>
            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Total</span>
            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{formatAmount(estimate.total, estimate.currency_symbol)}</span>
          </div>
        </div>
      )}

      {error && <p className="error-text">{error}</p>}

      {!estimate ? (
        <button
          className="btn btn-primary"
          onClick={handleEstimate}
          disabled={loading || !amount || parseFloat(amount) <= 0 || !address.trim()}
          style={{ marginTop: 8 }}
        >
          {loading ? 'Calculating...' : 'Continue'}
        </button>
      ) : (
        <button
          className="btn btn-primary"
          onClick={() => setShowConfirm(true)}
          disabled={loading}
          style={{ marginTop: 8 }}
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
            <div className="info-row">
              <span style={{ color: 'var(--text-secondary)' }}>Amount</span>
              <span style={{ fontWeight: 600 }}>{formatAmount(estimate.amount, estimate.currency_symbol)}</span>
            </div>
            <div className="info-row">
              <span style={{ color: 'var(--text-secondary)' }}>Fee ({formatTarif(estimate)})</span>
              <span style={{ fontWeight: 600 }}>{formatAmount(estimate.fee, estimate.currency_symbol)}</span>
            </div>
            <div className="info-row" style={{ borderTop: '1px solid var(--border-glass)', paddingTop: 12, marginTop: 4 }}>
              <span style={{ fontWeight: 700 }}>Total</span>
              <span style={{ fontWeight: 700 }}>{formatAmount(estimate.total, estimate.currency_symbol)}</span>
            </div>
            <div className="info-row" style={{ marginTop: 8 }}>
              <span style={{ color: 'var(--text-muted)' }}>Address</span>
              <span style={{ fontSize: 11, wordBreak: 'break-all', maxWidth: '60%', textAlign: 'right', color: 'var(--text-secondary)' }}>
                {address}
              </span>
            </div>
          </div>
        )}
      </ConfirmDialog>
    </div>
  );
}
