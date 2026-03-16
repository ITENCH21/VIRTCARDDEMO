import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ConfirmDialog from '../components/ConfirmDialog';
import { useBalance } from '../hooks/useBalance';
import { estimateWithdraw, createWithdraw, WithdrawEstimateResponse } from '../api/withdraw';
import { formatAmount } from '../lib/format';
import { hapticFeedback } from '../lib/telegram';
import { CheckIcon } from '../components/icons';
import { useLang } from '../contexts/LangContext';

const TRC20_RE = /^T[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]{33}$/;
function isValidTrc20(addr: string) { return TRC20_RE.test(addr.trim()); }

const PRESETS = [50, 100, 200, 500, 1000];

export default function WithdrawPage() {
  const navigate = useNavigate();
  const { data: balanceData } = useBalance();
  const { t } = useLang();
  const mainAccount = balanceData?.accounts?.[0];
  const [amount, setAmount] = useState('');
  const [address, setAddress] = useState('');
  const [estimate, setEstimate] = useState<WithdrawEstimateResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [addressError, setAddressError] = useState<string | null>(null);

  const formatTarif = (est: WithdrawEstimateResponse): string => {
    const parts: string[] = [];
    if (est.fee_percent !== '0') parts.push(`${est.fee_percent}%`);
    if (est.fee_fixed !== '0') parts.push(`+ ${est.fee_fixed} ${est.currency_symbol} ${t('fixed_fee')}`);
    if (est.fee_minimal !== '0') parts.push(`${t('min_fee')} ${est.fee_minimal} ${est.currency_symbol}`);
    return parts.join(', ') || t('free');
  };

  const handleAmountChange = (val: string) => { setAmount(val); setEstimate(null); };

  const handleEstimate = async () => {
    if (!amount || parseFloat(amount) <= 0) return;
    const trimmed = address.trim();
    if (!trimmed) { setAddressError(t('address_err_empty')); return; }
    if (!isValidTrc20(trimmed)) { setAddressError(t('address_err_invalid')); return; }
    setAddressError(null);
    setLoading(true);
    setError(null);
    try {
      setEstimate(await estimateWithdraw(amount));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Ошибка расчёта');
    } finally { setLoading(false); }
  };

  const handleWithdraw = async () => {
    setLoading(true); setError(null);
    try {
      await createWithdraw(amount, address.trim());
      setShowConfirm(false); setSubmitted(true);
      hapticFeedback('notification');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Ошибка вывода');
      hapticFeedback('notification');
    } finally { setLoading(false); }
  };

  /* ── Success screen ── */
  if (submitted) {
    return (
      <div className="page" style={{ paddingTop: 60, textAlign: 'center' }}>
        <div style={{
          width: 80, height: 80, borderRadius: '50%', margin: '0 auto 24px',
          background: 'linear-gradient(135deg, rgba(16,185,129,0.2), rgba(16,185,129,0.05))',
          border: '2px solid rgba(16,185,129,0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--success)',
          boxShadow: '0 8px 32px rgba(16,185,129,0.2)',
        }}>
          <CheckIcon size={36} />
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>
          {t('withdraw_success_title')}
        </h2>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: 280, margin: '0 auto 32px' }}>
          {t('withdraw_success_desc')}
        </p>
        <button className="btn btn-primary" onClick={() => navigate('/history')}>{t('to_history')}</button>
        <button className="btn btn-secondary" style={{ marginTop: 10 }} onClick={() => navigate('/')}>{t('to_home')}</button>
      </div>
    );
  }

  /* ── Main form ── */
  return (
    <div className="page">

      {/* Balance */}
      {mainAccount && (
        <div style={{
          borderRadius: 'var(--radius-xl)', padding: '20px 24px', marginBottom: 20,
          background: 'linear-gradient(135deg, #1e3a5f, #1e40af, #2563eb)',
          boxShadow: '0 8px 32px rgba(37,99,235,0.35)',
          textAlign: 'center', position: 'relative', overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', top: '-40%', right: '-20%', width: 160, height: 160,
            background: 'radial-gradient(circle, rgba(255,255,255,0.08), transparent 70%)',
            borderRadius: '50%', pointerEvents: 'none',
          }} />
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
            {t('withdraw_available')}
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, color: '#fff', letterSpacing: -0.5 }}>
            {formatAmount(mainAccount.available, mainAccount.currency_symbol)}
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>
            {mainAccount.currency_code} · {t('main_account')}
          </div>
        </div>
      )}

      {/* Form: amount + address + fee in one block */}
      <div className="glass-card" style={{ padding: '20px 20px', marginBottom: 16 }}>

        {/* Amount */}
        <div style={{ marginBottom: 18 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>
            {t('withdraw_amount_label')}
          </label>
          <input
            type="number"
            inputMode="decimal"
            value={amount}
            onChange={(e) => handleAmountChange(e.target.value)}
            placeholder="0.00"
            className="form-input"
            style={{ fontSize: 20, fontWeight: 700, textAlign: 'center' }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            {PRESETS.map((p) => (
              <button
                key={p}
                onClick={() => handleAmountChange(String(p))}
                style={{
                  flex: 1, minWidth: 48, padding: '6px 4px', borderRadius: 10,
                  fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  background: amount === String(p) ? 'var(--accent-gradient)' : 'var(--bg-glass)',
                  border: amount === String(p) ? '1px solid transparent' : '1px solid var(--border-glass)',
                  color: amount === String(p) ? '#fff' : 'var(--text-secondary)',
                  transition: 'var(--transition-fast)',
                }}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: 'var(--border-glass)', marginBottom: 18 }} />

        {/* Address */}
        <div style={{ marginBottom: estimate ? 18 : 0 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>
            {t('recipient_address')}
          </label>
          <div style={{ position: 'relative' }}>
            <div style={{
              position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
              width: 22, height: 22, borderRadius: 6,
              background: 'rgba(6,182,212,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              pointerEvents: 'none',
            }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="#06b6d4" strokeWidth="2" width="12" height="12">
                <circle cx="12" cy="12" r="10"/>
                <line x1="2" y1="12" x2="22" y2="12"/>
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
              </svg>
            </div>
            <input
              type="text"
              value={address}
              onChange={(e) => { setAddress(e.target.value); setAddressError(null); setEstimate(null); }}
              placeholder={t('address_placeholder')}
              className="form-input"
              style={{
                paddingLeft: 42, fontSize: 13,
                borderColor: addressError ? 'var(--danger)' : undefined,
              }}
            />
          </div>
          {addressError && (
            <div style={{
              marginTop: 8, padding: '8px 12px', borderRadius: 8,
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
              fontSize: 12, color: 'var(--danger)',
            }}>
              {addressError}
            </div>
          )}
        </div>

        {/* Fee — appears inside the same block */}
        {estimate && (
          <>
            <div style={{ height: 1, background: 'var(--border-glass)', marginBottom: 14 }} />
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 }}>
              {t('fee_calc_title')}
            </div>
            <div className="info-row">
              <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{t('tarif_label')}</span>
              <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{formatTarif(estimate)}</span>
            </div>
            <div className="info-row">
              <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{t('fee_label')}</span>
              <span style={{ fontWeight: 600, fontSize: 13 }}>{formatAmount(estimate.fee, estimate.currency_symbol)}</span>
            </div>
            <div className="info-row" style={{ borderTop: '1px solid var(--border-glass)', paddingTop: 12, marginTop: 6 }}>
              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{t('total_debit')}</span>
              <span style={{ fontWeight: 800, fontSize: 16, color: 'var(--text-primary)' }}>
                {formatAmount(estimate.total, estimate.currency_symbol)}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Warning */}
      <div style={{
        display: 'flex', gap: 10, alignItems: 'flex-start',
        padding: '12px 16px', marginBottom: 20,
        background: 'rgba(245,158,11,0.06)', borderRadius: 'var(--radius-md)',
        border: '1px solid rgba(245,158,11,0.2)', borderLeft: '3px solid var(--warning)',
      }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="var(--warning)" strokeWidth="2" width="16" height="16" style={{ flexShrink: 0, marginTop: 1 }}>
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
          {t('withdraw_network_warning')}
        </p>
      </div>

      {error && (
        <div style={{
          marginBottom: 12, padding: '10px 14px', borderRadius: 10,
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
          fontSize: 13, color: 'var(--danger)',
        }}>
          {error}
        </div>
      )}

      {/* Button */}
      {!estimate ? (
        <button
          className="btn btn-primary"
          onClick={handleEstimate}
          disabled={loading || !amount || parseFloat(amount) <= 0 || !address.trim()}
        >
          {loading ? t('calculating') : t('calc_fee')}
        </button>
      ) : (
        <button className="btn btn-primary" onClick={() => setShowConfirm(true)} disabled={loading}>
          {t('do_withdraw')}
        </button>
      )}

      {/* Confirm dialog */}
      <ConfirmDialog
        open={showConfirm}
        title={t('confirm_withdraw_title')}
        confirmLabel={t('confirm_withdraw_btn')}
        onConfirm={handleWithdraw}
        onCancel={() => setShowConfirm(false)}
        loading={loading}
      >
        {estimate && (
          <div>
            <div className="info-row">
              <span style={{ color: 'var(--text-secondary)' }}>{t('amount_label')}</span>
              <span style={{ fontWeight: 600 }}>{formatAmount(estimate.amount, estimate.currency_symbol)}</span>
            </div>
            <div className="info-row">
              <span style={{ color: 'var(--text-secondary)' }}>{t('fee_label')} ({formatTarif(estimate)})</span>
              <span style={{ fontWeight: 600 }}>{formatAmount(estimate.fee, estimate.currency_symbol)}</span>
            </div>
            <div className="info-row" style={{ borderTop: '1px solid var(--border-glass)', paddingTop: 12, marginTop: 4 }}>
              <span style={{ fontWeight: 700 }}>{t('total_label')}</span>
              <span style={{ fontWeight: 700 }}>{formatAmount(estimate.total, estimate.currency_symbol)}</span>
            </div>
            <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 8, background: 'var(--bg-glass)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{t('recipient_address')}</div>
              <div style={{ fontSize: 11, wordBreak: 'break-all', color: 'var(--text-secondary)', fontFamily: "'SF Mono','Menlo',monospace" }}>
                {address}
              </div>
            </div>
          </div>
        )}
      </ConfirmDialog>
    </div>
  );
}
