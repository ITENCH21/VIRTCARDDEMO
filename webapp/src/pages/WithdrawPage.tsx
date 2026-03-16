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
  if (est.fee_fixed !== '0') parts.push(`+ ${est.fee_fixed} ${est.currency_symbol} фикс.`);
  if (est.fee_minimal !== '0') parts.push(`мин. ${est.fee_minimal} ${est.currency_symbol}`);
  return parts.join(', ') || 'Бесплатно';
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
      setAddressError('Введите USDT TRC-20 адрес');
      return;
    }
    if (!isValidTrc20(trimmed)) {
      setAddressError('Неверный формат TRC-20 адреса');
      return;
    }
    setAddressError(null);
    setLoading(true);
    setError(null);
    try {
      const est = await estimateWithdraw(amount);
      setEstimate(est);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Ошибка расчёта');
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
      hapticFeedback('notification');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Ошибка вывода');
      hapticFeedback('notification');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="page" style={{ paddingTop: 60, textAlign: 'center' }}>
        <div style={{
          width: 72, height: 72, borderRadius: '50%', margin: '0 auto 24px',
          background: 'rgba(16,185,129,0.15)',
          border: '2px solid rgba(16,185,129,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--success)',
        }}>
          <CheckIcon size={32} />
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>
          Заявка отправлена!
        </h2>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 32, maxWidth: 280, margin: '0 auto 32px' }}>
          Ваш запрос обрабатывается. Вы получите уведомление после завершения.
        </p>
        <button className="btn btn-primary" onClick={() => navigate('/history')}>
          История операций
        </button>
        <button className="btn btn-secondary" style={{ marginTop: 10 }} onClick={() => navigate('/')}>
          На главную
        </button>
      </div>
    );
  }

  return (
    <div className="page">
      {/* Доступный баланс */}
      {mainAccount && (
        <div className="glass-card" style={{ padding: '18px 20px', marginBottom: 20, textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>
            Доступный баланс
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)' }}>
            {formatAmount(mainAccount.available, mainAccount.currency_symbol)}
          </div>
        </div>
      )}

      {/* Сумма */}
      <AmountInput
        value={amount}
        onChange={handleAmountChange}
        label="Сумма вывода"
        presets={[50, 100, 200, 500, 1000]}
      />

      {/* Адрес */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
          Адрес USDT TRC-20
        </label>
        <input
          type="text"
          value={address}
          onChange={(e) => { setAddress(e.target.value); setAddressError(null); setEstimate(null); }}
          placeholder="T..."
          className="form-input"
          style={{ borderColor: addressError ? 'var(--danger)' : undefined }}
        />
        {addressError && <p className="error-text" style={{ marginTop: 6 }}>{addressError}</p>}
      </div>

      {/* Комиссия */}
      {estimate && (
        <div className="glass-card" style={{ padding: '16px 20px', marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12 }}>
            Расчёт комиссии
          </div>
          <div className="info-row">
            <span style={{ color: 'var(--text-muted)' }}>Тариф</span>
            <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{formatTarif(estimate)}</span>
          </div>
          <div className="info-row">
            <span style={{ color: 'var(--text-muted)' }}>Комиссия</span>
            <span style={{ fontWeight: 600 }}>{formatAmount(estimate.fee, estimate.currency_symbol)}</span>
          </div>
          <div className="info-row" style={{ borderTop: '1px solid var(--border-glass)', paddingTop: 10, marginTop: 4 }}>
            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Итого к списанию</span>
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
          {loading ? 'Расчёт...' : 'Рассчитать'}
        </button>
      ) : (
        <button
          className="btn btn-primary"
          onClick={() => setShowConfirm(true)}
          disabled={loading}
          style={{ marginTop: 8 }}
        >
          Вывести средства
        </button>
      )}

      <ConfirmDialog
        open={showConfirm}
        title="Подтверждение вывода"
        confirmLabel="Вывести"
        onConfirm={handleWithdraw}
        onCancel={() => setShowConfirm(false)}
        loading={loading}
      >
        {estimate && (
          <div>
            <div className="info-row">
              <span style={{ color: 'var(--text-secondary)' }}>Сумма</span>
              <span style={{ fontWeight: 600 }}>{formatAmount(estimate.amount, estimate.currency_symbol)}</span>
            </div>
            <div className="info-row">
              <span style={{ color: 'var(--text-secondary)' }}>Комиссия ({formatTarif(estimate)})</span>
              <span style={{ fontWeight: 600 }}>{formatAmount(estimate.fee, estimate.currency_symbol)}</span>
            </div>
            <div className="info-row" style={{ borderTop: '1px solid var(--border-glass)', paddingTop: 12, marginTop: 4 }}>
              <span style={{ fontWeight: 700 }}>Итого</span>
              <span style={{ fontWeight: 700 }}>{formatAmount(estimate.total, estimate.currency_symbol)}</span>
            </div>
            <div className="info-row" style={{ marginTop: 8 }}>
              <span style={{ color: 'var(--text-muted)' }}>Адрес</span>
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
