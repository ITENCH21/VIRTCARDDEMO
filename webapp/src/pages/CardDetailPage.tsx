import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCard } from '../hooks/useCards';
import { fetchCardSensitive, blockCard, restoreCard, closeCard, syncOperation, CardSensitiveResponse } from '../api/cards';
import { usePolling } from '../hooks/usePolling';
import VirtualCard from '../components/VirtualCard';
import PollingScreen from '../components/PollingScreen';
import StatusBadge from '../components/StatusBadge';
import ConfirmDialog from '../components/ConfirmDialog';
import Spinner from '../components/Spinner';
import { EyeIcon, EyeOffIcon, CopyIcon, LockIcon, UnlockIcon, XIcon } from '../components/icons';
import { formatAmount, formatCardNumber } from '../lib/format';
import { hapticFeedback } from '../lib/telegram';
import { useLang } from '../contexts/LangContext';

export default function CardDetailPage() {
  const { t } = useLang();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { card, loading, error, refresh } = useCard(id!);
  const [sensitive, setSensitive] = useState<CardSensitiveResponse | null>(null);
  const [showSensitive, setShowSensitive] = useState(false);
  const [loadingSensitive, setLoadingSensitive] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'block' | 'restore' | 'close' | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [operationId, setOperationId] = useState<string | null>(null);
  const [actionType, setActionType] = useState('');
  const { isComplete, isFailed, isPolling } = usePolling(operationId);
  const [copied, setCopied] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const ACTION_LABELS: Record<string, { pending: string; done: string }> = {
    block:   { pending: t('card_blocking'), done: t('card_blocked_done') },
    restore: { pending: t('card_restoring'), done: t('card_restored_done') },
    close:   { pending: t('card_closing_op'), done: t('card_closed_done') },
  };

  const handleReveal = async () => {
    if (showSensitive) {
      setShowSensitive(false);
      return;
    }
    setLoadingSensitive(true);
    try {
      const data = await fetchCardSensitive(id!);
      setSensitive(data);
      setShowSensitive(true);
    } catch {
      setActionError(t('card_err_load'));
    } finally {
      setLoadingSensitive(false);
    }
  };

  const handleCopy = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(field);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // clipboard не доступен
    }
  };

  const handleAction = async () => {
    if (!confirmAction || !id) return;
    setActionLoading(true);
    setActionError(null);
    try {
      let res;
      if (confirmAction === 'block') res = await blockCard(id);
      else if (confirmAction === 'restore') res = await restoreCard(id);
      else res = await closeCard(id);
      setActionType(confirmAction);
      setOperationId(res.operation_id);
      setConfirmAction(null);
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : t('card_err_op'));
      hapticFeedback('notification');
    } finally {
      setActionLoading(false);
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
      setSyncMessage(e instanceof Error ? e.message : 'Ошибка синхронизации');
      hapticFeedback('notification');
    } finally {
      setSyncing(false);
    }
  };

  const handleDone = () => {
    setOperationId(null);
    refresh();
  };

  const timedOut = !isPolling && !isComplete && !isFailed && !!operationId;

  if (operationId) {
    const labels = ACTION_LABELS[actionType] || { pending: 'Обработка...', done: 'Готово' };
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
            {labels.pending}
          </p>
        )}
        {isComplete && (
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 17, fontWeight: 600, color: 'var(--success)', marginTop: 8 }}>{labels.done}</p>
            <button className="btn btn-primary" style={{ marginTop: 24 }} onClick={handleDone}>
              {t('return_to_card')}
            </button>
          </div>
        )}
        {isFailed && (
          <div style={{ textAlign: 'center' }}>
            <button className="btn btn-primary" style={{ marginTop: 24 }} onClick={handleDone}>
              {t('return_to_card')}
            </button>
          </div>
        )}
        {timedOut && (
          <div style={{ textAlign: 'center' }}>
            <button className="btn btn-secondary" style={{ marginTop: 16 }} onClick={handleDone}>
              {t('return_to_card')}
            </button>
          </div>
        )}
      </div>
    );
  }

  if (loading) return <div className="page"><Spinner /></div>;
  if (error || !card) return <div className="page"><p className="error-text">{error || t('card_not_found')}</p></div>;

  const isActive  = card.status === 'A' || card.status === 'R';
  const isBlocked = card.status === 'L';
  const isClosing = card.status === 'P';
  const isClosed  = card.status === 'C' || card.status === 'B';

  return (
    <div className="page">
      <div className="page-wide card-detail-grid" style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 400px) minmax(0, 1fr)',
        gap: 32,
        alignItems: 'start',
      }}>
        {/* Left: Card visual + status */}
        <div>
          <div style={{ marginBottom: 16 }}>
            <VirtualCard
              name={card.name}
              last4={card.last4}
              balance={formatAmount(card.balance, card.currency_symbol)}
              currencySymbol=""
              currencyCode={card.currency_code}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
            <StatusBadge status={card.status} label={isClosing ? t('card_closing_status') : undefined} />
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {isActive && (
              <>
                <button className="btn btn-primary" onClick={() => navigate(`/cards/${id}/topup`)}>
                  {t('topup_card')}
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => setConfirmAction('block')}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                >
                  <LockIcon size={18} /> {t('block_card')}
                </button>
              </>
            )}
            {isBlocked && (
              <button
                className="btn btn-primary"
                onClick={() => setConfirmAction('restore')}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                <UnlockIcon size={18} /> {t('unblock_card')}
              </button>
            )}
            {!isClosed && !isClosing && (
              <button
                className="btn btn-danger"
                onClick={() => setConfirmAction('close')}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                <XIcon size={18} /> {t('close_card')}
              </button>
            )}
          </div>
        </div>

        {/* Right: Credentials */}
        <div>
      <div className="glass-card" style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showSensitive ? 16 : 0 }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>{t('card_credentials')}</span>
          <button
            onClick={handleReveal}
            disabled={loadingSensitive}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 14px', borderRadius: 20, cursor: 'pointer',
              background: 'var(--accent-gradient)', border: 'none',
              color: '#fff', fontSize: 13, fontWeight: 600,
              opacity: loadingSensitive ? 0.6 : 1,
              transition: 'opacity 0.15s ease',
            }}
          >
            {loadingSensitive
              ? '...'
              : showSensitive
                ? <><EyeOffIcon size={15} /> {t('btn_hide')}</>
                : <><EyeIcon size={15} /> {t('btn_show')}</>
            }
          </button>
        </div>

        {showSensitive && sensitive && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Номер карты */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '12px 16px', background: 'var(--bg-glass)', borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-glass)',
            }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8 }}>{t('card_number_label')}</div>
                <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "'SF Mono','Menlo','Consolas',monospace", color: 'var(--text-primary)', marginTop: 4, letterSpacing: 1 }}>
                  {formatCardNumber(sensitive.card_number)}
                </div>
              </div>
              <button
                onClick={() => handleCopy(sensitive.card_number, 'number')}
                style={{ background: 'none', border: 'none', color: copied === 'number' ? 'var(--success)' : 'var(--text-muted)', cursor: 'pointer', padding: 6 }}
              >
                <CopyIcon size={18} />
              </button>
            </div>

            {/* Срок и CVV */}
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{
                flex: 1, padding: '12px 16px', background: 'var(--bg-glass)', borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-glass)',
              }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8 }}>{t('expiry_label')}</div>
                <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "'SF Mono','Menlo','Consolas',monospace", color: 'var(--text-primary)', marginTop: 4 }}>
                  {sensitive.expiry_month}/{sensitive.expiry_year}
                </div>
              </div>
              <div style={{
                flex: 1, padding: '12px 16px', background: 'var(--bg-glass)', borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-glass)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
              }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8 }}>CVV</div>
                  <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "'SF Mono','Menlo','Consolas',monospace", color: 'var(--text-primary)', marginTop: 4 }}>
                    {sensitive.cvv}
                  </div>
                </div>
                <button
                  onClick={() => handleCopy(sensitive.cvv, 'cvv')}
                  style={{ background: 'none', border: 'none', color: copied === 'cvv' ? 'var(--success)' : 'var(--text-muted)', cursor: 'pointer', padding: 4, marginTop: -2 }}
                >
                  <CopyIcon size={16} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

        </div>
      </div>

      {actionError && <p className="error-text" style={{ marginTop: 12 }}>{actionError}</p>}

      <style>{`
        @media (max-width: 768px) {
          .card-detail-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <ConfirmDialog
        open={!!confirmAction}
        title={
          confirmAction === 'block'   ? t('block_card') :
          confirmAction === 'restore' ? t('unblock_card') :
          t('close_card')
        }
        confirmLabel={confirmAction === 'close' ? t('confirm_label_close') : t('confirm_label_ok')}
        danger={confirmAction === 'close'}
        onConfirm={handleAction}
        onCancel={() => setConfirmAction(null)}
        loading={actionLoading}
      >
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          {confirmAction === 'block'   && t('confirm_block_text')}
          {confirmAction === 'restore' && t('confirm_restore_text')}
          {confirmAction === 'close'   && t('confirm_close_text')}
        </p>
      </ConfirmDialog>
    </div>
  );
}
