import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCard } from '../hooks/useCards';
import AmountInput from '../components/AmountInput';
import ConfirmDialog from '../components/ConfirmDialog';
import PollingScreen from '../components/PollingScreen';
import Spinner from '../components/Spinner';
import { estimateTopup, topupCard, fetchTopupLimits, EstimateResponse, AmountLimitsResponse } from '../api/cards';
import { usePolling } from '../hooks/usePolling';
import { formatAmount } from '../lib/format';
import { hapticFeedback } from '../lib/telegram';
import { useLang } from '../contexts/LangContext';

export default function CardTopupPage() {
  const { t } = useLang();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { card, loading: cardLoading } = useCard(id!);
  const [amount, setAmount] = useState('');
  const [estimate, setEstimate] = useState<EstimateResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [operationId, setOperationId] = useState<string | null>(null);
  const [limits, setLimits] = useState<AmountLimitsResponse | null>(null);

  const { status, isComplete, isFailed, isPolling } = usePolling(operationId);

  useEffect(() => {
    if (id) {
      fetchTopupLimits(id)
        .then(setLimits)
        .catch(() => {});
    }
  }, [id]);

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
      hapticFeedback('notification');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Topup failed');
      hapticFeedback('notification');
    } finally {
      setLoading(false);
    }
  };

  if (cardLoading) return <div className="page"><Spinner /></div>;

  const timedOut = !isPolling && !isComplete && !isFailed && !!operationId;

  if (operationId) {
    return (
      <div className="page" style={{ paddingTop: 40 }}>
        <PollingScreen
          isPolling={isPolling}
          isComplete={isComplete}
          isFailed={isFailed}
          timedOut={timedOut}
        />
        {isPolling && (
          <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            {t('topup_processing')}
          </p>
        )}
        {isComplete && (
          <div style={{ textAlign: 'center' }}>
            <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={() => navigate(`/cards/${id}`)}>
              {t('topup_back')}
            </button>
          </div>
        )}
        {isFailed && (
          <div style={{ textAlign: 'center' }}>
            <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={() => { setOperationId(null); setError(null); }}>
              {t('topup_try_again')}
            </button>
          </div>
        )}
        {timedOut && (
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <button className="btn btn-secondary" onClick={() => navigate('/history')}>
              {t('topup_view_history')}
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="page">
      <div className="desktop-form-centered">
      <h1 className="page-title">{t('topup_title')}</h1>

      {card && (
        <div className="glass-card" style={{ padding: '16px 20px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{card.name}</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>****{card.last4}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('topup_balance')}</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>
              {formatAmount(card.balance, card.currency_symbol)}
            </div>
          </div>
        </div>
      )}

      <AmountInput
        value={amount}
        onChange={setAmount}
        error={isAmountInvalid}
        hint={limitsHint}
        presets={[50, 100, 200, 300, 500, 1000]}
      />

      {error && <p className="error-text">{error}</p>}

      <button
        className="btn btn-primary"
        onClick={handleEstimate}
        disabled={loading || !amount || parseFloat(amount) <= 0 || isAmountInvalid}
        style={{ marginTop: 8 }}
      >
        {loading ? t('topup_calculating') : t('topup_continue')}
      </button>

      {/* Info hint */}
      <div className="glass-card" style={{
        padding: '12px 16px', marginTop: 16,
        borderLeft: '3px solid var(--accent-1)',
      }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="var(--accent-1)" strokeWidth="2" width="16" height="16" style={{ flexShrink: 0, marginTop: 1 }}>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
            {t('issue_usdt_note')}
          </p>
        </div>
      </div>

      </div>{/* end desktop-form-centered */}

      <ConfirmDialog
        open={showConfirm}
        title={t('topup_confirm_title')}
        confirmLabel={t('topup_confirm_btn')}
        onConfirm={handleTopup}
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
              <span style={{ color: 'var(--text-secondary)' }}>{t('fee_label')}</span>
              <span style={{ fontWeight: 600 }}>{formatAmount(estimate.fee, estimate.currency_symbol)}</span>
            </div>
            <div className="info-row" style={{ borderTop: '1px solid var(--border-glass)', paddingTop: 12, marginTop: 4 }}>
              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{t('total_label')}</span>
              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{formatAmount(estimate.total, estimate.currency_symbol)}</span>
            </div>
          </div>
        )}
      </ConfirmDialog>
    </div>
  );
}
