import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import ConfirmDialog from '../components/ConfirmDialog';
import PollingScreen from '../components/PollingScreen';
import { estimateIssue, issueCard, syncOperation, fetchIssueLimits, EstimateResponse, AmountLimitsResponse, CardCurrency, CardType } from '../api/cards';
import { usePolling } from '../hooks/usePolling';
import { formatAmount } from '../lib/format';
import { hapticFeedback } from '../lib/telegram';
import { useLang } from '../contexts/LangContext';

const PRESETS = [50, 100, 150, 200, 300, 500];

const CHECK_ICON = (
  <svg viewBox="0 0 20 20" fill="none" width="14" height="14">
    <circle cx="10" cy="10" r="10" fill="rgba(16,185,129,0.15)" />
    <polyline points="5,10 8.5,13.5 15,7" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const CROSS_ICON = (
  <svg viewBox="0 0 20 20" fill="none" width="14" height="14">
    <circle cx="10" cy="10" r="10" fill="rgba(239,68,68,0.12)" />
    <line x1="7" y1="7" x2="13" y2="13" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
    <line x1="13" y1="7" x2="7" y2="13" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export default function CardIssuePage() {
  const { t, lang } = useLang();
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
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const { isComplete, isFailed, isPolling } = usePolling(operationId);

  useEffect(() => {
    fetchIssueLimits().then(setLimits).catch(() => {});
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

  const handleAmountChange = (val: string) => { setAmount(val); setEstimate(null); };
  const handleTypeChange = (type: CardType) => { setCardType(type); setEstimate(null); };
  const handleCurrencyChange = (currency: CardCurrency) => { setCardCurrency(currency); setEstimate(null); };

  const handleEstimate = async () => {
    if (!amount || parseFloat(amount) <= 0) return;
    setLoading(true);
    setError(null);
    try {
      setEstimate(await estimateIssue(amount));
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

  /* ── Polling screen ── */
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
          <p style={{ textAlign: 'center', fontSize: 14, color: 'var(--text-secondary)', marginTop: 8 }}>
            {lang === 'ru' ? 'Выпускаем карту...' : 'Issuing card...'}
          </p>
        )}
        {isComplete && (
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 17, fontWeight: 600, color: 'var(--success)', marginTop: 8 }}>{t('card_ready')}</p>
            <button className="btn btn-primary" style={{ marginTop: 24 }} onClick={() => navigate('/cards')}>
              {t('view_cards')}
            </button>
          </div>
        )}
        {isFailed && (
          <div style={{ textAlign: 'center' }}>
            <button className="btn btn-primary" style={{ marginTop: 24 }} onClick={() => { setOperationId(null); setError(null); }}>
              {t('try_again')}
            </button>
          </div>
        )}
        {timedOut && (
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <button className="btn btn-secondary" onClick={() => navigate('/history')}>
              {t('view_history')}
            </button>
          </div>
        )}
      </div>
    );
  }

  /* ── Card info specs ── */
  const CARD_INFO = [
    {
      type: 'standard' as CardType,
      title: t('issue_standard'),
      subtitle: 'VISA & Mastercard · USD, EUR',
      specs: [
        { label: t('tr_open_cost'), value: '$6 / €6' },
        { label: t('tr_topup_fee'), value: '6%' },
        { label: t('tr_min_open'), value: '$100 / €100' },
        { label: t('tr_3ds'), bool: true },
        { label: t('tr_apple'), bool: false },
        { label: t('tr_google'), bool: false },
      ],
    },
    {
      type: 'wallet' as CardType,
      title: 'Apple / Google Pay',
      subtitle: 'Mastercard · USD, EUR',
      popular: true,
      specs: [
        { label: t('tr_open_cost'), value: '$15 / €15' },
        { label: t('tr_topup_fee'), value: '5%' },
        { label: t('tr_min_open'), value: '$50 / €50' },
        { label: t('tr_3ds'), bool: false },
        { label: t('tr_apple'), bool: true },
        { label: t('tr_google'), bool: true },
        { label: t('tr_offline'), bool: true },
      ],
    },
  ];

  return (
    <div className="page">
      {/* ── Card type comparison — 2 columns ── */}
      <div className="page-wide issue-cards-grid" style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 16,
        marginBottom: 28,
      }}>
        {CARD_INFO.map((info) => {
          const selected = cardType === info.type;
          return (
            <div
              key={info.type}
              onClick={() => handleTypeChange(info.type)}
              className="glass-card"
              style={{
                padding: 0, overflow: 'hidden', cursor: 'pointer',
                border: selected
                  ? '2px solid rgba(99,102,241,0.55)'
                  : '1px solid var(--border)',
                boxShadow: selected ? '0 4px 24px rgba(99,102,241,0.15)' : undefined,
                transition: 'all 0.2s ease',
                position: 'relative',
              }}
            >
              {info.popular && (
                <div style={{
                  position: 'absolute', top: 0, right: 16,
                  background: 'var(--accent-gradient)',
                  color: '#fff', fontSize: 10, fontWeight: 700,
                  padding: '3px 10px', borderRadius: '0 0 8px 8px',
                  letterSpacing: 0.5, textTransform: 'uppercase',
                }}>
                  {t('tariffs_popular')}
                </div>
              )}

              {/* Header */}
              <div style={{ padding: '16px 18px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>
                    {info.title}
                  </div>
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                    background: selected ? 'linear-gradient(135deg, #2563eb, #4f46e5)' : 'var(--bg-input)',
                    border: selected ? 'none' : '1.5px solid var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: selected ? '0 2px 8px rgba(79,70,229,0.4)' : 'none',
                  }}>
                    {selected && <svg viewBox="0 0 20 20" fill="none" width="12" height="12"><polyline points="4,10 8,14 16,6" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                  </div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{info.subtitle}</div>
              </div>

              {/* Specs rows */}
              <div style={{ borderTop: '1px solid var(--tx-border)' }}>
                {info.specs.map((row, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '9px 18px',
                    borderBottom: i < info.specs.length - 1 ? '1px solid var(--tx-border)' : 'none',
                  }}>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{row.label}</span>
                    {row.bool !== undefined ? (
                      <span>{row.bool ? CHECK_ICON : CROSS_ICON}</span>
                    ) : (
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{row.value}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Issue Form — centered below ── */}
      <div className="desktop-form-centered">
        <div className="glass-card" style={{ padding: 20, marginBottom: 16 }}>
          {/* Currency toggle */}
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>
              {t('issue_currency_label')}
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['USD', 'EUR'] as CardCurrency[]).map((cur) => (
                <button
                  key={cur}
                  onClick={() => handleCurrencyChange(cur)}
                  style={{
                    flex: 1, padding: '10px 0', borderRadius: 10,
                    fontSize: 14, fontWeight: 700, cursor: 'pointer',
                    background: cardCurrency === cur ? 'var(--accent-gradient)' : 'var(--bg-card)',
                    border: cardCurrency === cur ? '1px solid transparent' : '1px solid var(--border)',
                    color: cardCurrency === cur ? '#fff' : 'var(--text-secondary)',
                    transition: 'var(--transition-fast)',
                    boxShadow: cardCurrency === cur ? '0 2px 12px rgba(79,70,229,0.3)' : 'var(--shadow-sm)',
                  }}
                >
                  {cur}
                </button>
              ))}
            </div>
          </div>

          <div style={{ height: 1, background: 'var(--border)', marginBottom: 18 }} />

          {/* Card name */}
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>
              {t('issue_name_label')}
            </label>
            <input
              type="text"
              value={cardName}
              onChange={(e) => setCardName(e.target.value)}
              placeholder={t('issue_name_placeholder')}
              className="form-input"
              style={{ fontSize: 14 }}
            />
          </div>

          <div style={{ height: 1, background: 'var(--border)', marginBottom: 18 }} />

          {/* Amount */}
          <div style={{ marginBottom: estimate ? 18 : 0 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>
              {t('issue_amount_label')}
            </label>
            <input
              type="number"
              inputMode="decimal"
              value={amount}
              onChange={(e) => handleAmountChange(e.target.value)}
              placeholder="0.00"
              className="form-input"
              style={{
                fontSize: 20, fontWeight: 700, textAlign: 'center',
                borderColor: isAmountInvalid ? 'var(--danger)' : undefined,
              }}
            />
            {limitsHint && (
              <div style={{ marginTop: 6, fontSize: 12, color: isAmountInvalid ? 'var(--danger)' : 'var(--text-muted)', textAlign: 'center' }}>
                {limitsHint}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              {PRESETS.map((p) => (
                <button
                  key={p}
                  onClick={() => handleAmountChange(String(p))}
                  style={{
                    flex: 1, minWidth: 44, padding: '6px 4px', borderRadius: 10,
                    fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    background: amount === String(p) ? 'var(--accent-gradient)' : 'var(--bg-card)',
                    border: amount === String(p) ? '1px solid transparent' : '1px solid var(--border)',
                    color: amount === String(p) ? '#fff' : 'var(--text-secondary)',
                    boxShadow: amount === String(p) ? '0 2px 12px rgba(79,70,229,0.3)' : 'var(--shadow-sm)',
                    transition: 'var(--transition-fast)',
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Fee breakdown */}
          {estimate && (
            <>
              <div style={{ height: 1, background: 'var(--border)', marginBottom: 14 }} />
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 }}>
                {t('fee_calc_title')}
              </div>
              <div className="info-row">
                <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{t('amount_label')}</span>
                <span style={{ fontWeight: 600, fontSize: 13 }}>{formatAmount(estimate.amount, estimate.currency_symbol)}</span>
              </div>
              <div className="info-row">
                <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{t('fee_label')}</span>
                <span style={{ fontWeight: 600, fontSize: 13 }}>{formatAmount(estimate.fee, estimate.currency_symbol)}</span>
              </div>
              <div className="info-row" style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 6 }}>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{t('total_debit')}</span>
                <span style={{ fontWeight: 800, fontSize: 16, color: 'var(--text-primary)' }}>
                  {formatAmount(estimate.total, estimate.currency_symbol)}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Info note */}
        <div className="glass-card" style={{
          padding: '12px 16px', marginBottom: 20,
          borderLeft: '3px solid #3b82f6',
        }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" width="16" height="16" style={{ flexShrink: 0, marginTop: 1 }}>
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
              {t('issue_usdt_note')}
            </p>
          </div>
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

        {/* Action button */}
        {!estimate ? (
          <button
            className="btn btn-primary"
            onClick={handleEstimate}
            disabled={loading || !amount || parseFloat(amount) <= 0 || isAmountInvalid}
          >
            {loading ? t('issue_calculating') : t('issue_calc_fee')}
          </button>
        ) : (
          <button className="btn btn-primary" onClick={() => setShowConfirm(true)} disabled={loading}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16" style={{ marginRight: 8 }}>
              <rect x="1" y="4" width="22" height="16" rx="2" />
              <line x1="1" y1="10" x2="23" y2="10" />
            </svg>
            {t('issue_do_issue')}
          </button>
        )}
      </div>

      {/* Confirm dialog */}
      <ConfirmDialog
        open={showConfirm}
        title={t('confirm_issue_title')}
        confirmLabel={t('confirm_issue_btn')}
        onConfirm={handleIssue}
        onCancel={() => setShowConfirm(false)}
        loading={loading}
      >
        {estimate && (
          <div>
            <div className="info-row">
              <span style={{ color: 'var(--text-secondary)' }}>{t('issue_type_label')}</span>
              <span style={{ fontWeight: 600 }}>
                {cardType === 'standard' ? t('issue_standard') : 'Apple / Google Pay'}
              </span>
            </div>
            <div className="info-row">
              <span style={{ color: 'var(--text-secondary)' }}>{t('issue_currency_label')}</span>
              <span style={{ fontWeight: 600 }}>{cardCurrency}</span>
            </div>
            <div className="info-row">
              <span style={{ color: 'var(--text-secondary)' }}>{t('amount_label')}</span>
              <span style={{ fontWeight: 600 }}>{formatAmount(estimate.amount, estimate.currency_symbol)}</span>
            </div>
            <div className="info-row">
              <span style={{ color: 'var(--text-secondary)' }}>{t('fee_label')}</span>
              <span style={{ fontWeight: 600 }}>{formatAmount(estimate.fee, estimate.currency_symbol)}</span>
            </div>
            <div className="info-row" style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 4 }}>
              <span style={{ fontWeight: 700 }}>{t('total_label')}</span>
              <span style={{ fontWeight: 700 }}>{formatAmount(estimate.total, estimate.currency_symbol)}</span>
            </div>
          </div>
        )}
      </ConfirmDialog>

      <style>{`
        @media (max-width: 768px) {
          .issue-cards-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
