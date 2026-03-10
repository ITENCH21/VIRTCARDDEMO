import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCard } from '../hooks/useCards';
import { fetchCardSensitive, blockCard, restoreCard, closeCard, CardSensitiveResponse } from '../api/cards';
import { usePolling } from '../hooks/usePolling';
import StatusBadge from '../components/StatusBadge';
import ConfirmDialog from '../components/ConfirmDialog';
import Spinner from '../components/Spinner';
import { formatAmount, formatCardNumber } from '../lib/format';
import { hapticFeedback } from '../lib/telegram';

const ACTION_LABELS: Record<string, { pending: string; done: string }> = {
  block: { pending: 'Blocking card...', done: 'Card Blocked' },
  restore: { pending: 'Restoring card...', done: 'Card Restored' },
  close: { pending: 'Closing card...', done: 'Card Closed' },
};

export default function CardDetailPage() {
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
      setActionError('Failed to load card details');
    } finally {
      setLoadingSensitive(false);
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
      setActionError(e instanceof Error ? e.message : 'Action failed');
      hapticFeedback('error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDone = () => {
    setOperationId(null);
    refresh();
  };

  // Operation in progress or finished — show status screen
  if (operationId) {
    const labels = ACTION_LABELS[actionType] || { pending: 'Processing...', done: 'Done' };
    return (
      <div className="page text-center" style={{ paddingTop: '60px' }}>
        {isPolling && (
          <>
            <Spinner />
            <p className="mt-16">{labels.pending}</p>
          </>
        )}
        {isComplete && (
          <>
            <h2 style={{ fontSize: '24px', color: 'var(--success-color)' }}>{labels.done}</h2>
            <button className="btn btn-primary mt-24" onClick={handleDone}>
              Back to Card
            </button>
          </>
        )}
        {isFailed && (
          <>
            <h2 style={{ fontSize: '24px', color: 'var(--danger-color)' }}>Operation Failed</h2>
            <p className="text-hint mt-8">Please try again</p>
            <button className="btn btn-primary mt-24" onClick={handleDone}>
              Back to Card
            </button>
          </>
        )}
        {!isPolling && !isComplete && !isFailed && (
          <>
            <p className="text-hint">Polling timed out</p>
            <button className="btn btn-primary mt-16" onClick={handleDone}>
              Back to Card
            </button>
          </>
        )}
      </div>
    );
  }

  if (loading) return <div className="page"><Spinner /></div>;
  if (error || !card) return <div className="page"><p className="error-text">{error || 'Card not found'}</p></div>;

  const isActive = card.status === 'A' || card.status === 'R';
  const isBlocked = card.status === 'L';
  const isClosing = card.status === 'P';
  const isClosed = card.status === 'C' || card.status === 'B';

  return (
    <div className="page">
      <h1 className="page-title">{card.name} ****{card.last4}</h1>

      <div className="card" style={{ textAlign: 'center', padding: '24px' }}>
        <StatusBadge status={card.status} label={isClosing ? 'Closing' : undefined} />
        <div style={{ fontSize: '28px', fontWeight: 700, marginTop: '12px' }}>
          {formatAmount(card.balance, card.currency_symbol)}
        </div>
      </div>

      {/* Sensitive data */}
      <div className="card mt-16">
        <div className="flex-between">
          <span style={{ fontWeight: 600 }}>Card Details</span>
          <button
            className="btn btn-outline"
            style={{ width: 'auto', padding: '6px 12px', fontSize: '13px' }}
            onClick={handleReveal}
            disabled={loadingSensitive}
          >
            {loadingSensitive ? '...' : showSensitive ? 'Hide' : 'Show'}
          </button>
        </div>
        {showSensitive && sensitive && (
          <div style={{ marginTop: '12px', fontFamily: 'monospace', fontSize: '16px' }}>
            <div className="mb-8">
              <span className="text-hint">Number: </span>
              {formatCardNumber(sensitive.card_number)}
            </div>
            <div className="flex gap-12">
              <div>
                <span className="text-hint">Exp: </span>
                {sensitive.expiry_month}/{sensitive.expiry_year}
              </div>
              <div>
                <span className="text-hint">CVV: </span>
                {sensitive.cvv}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="mt-16 flex gap-8" style={{ flexDirection: 'column' }}>
        {isActive && (
          <>
            <button className="btn btn-primary" onClick={() => navigate(`/cards/${id}/topup`)}>
              Topup Card
            </button>
            <button className="btn btn-secondary" onClick={() => setConfirmAction('block')}>
              Block Card
            </button>
          </>
        )}
        {isBlocked && (
          <button className="btn btn-primary" onClick={() => setConfirmAction('restore')}>
            Restore Card
          </button>
        )}
        {!isClosed && !isClosing && (
          <button className="btn btn-danger" onClick={() => setConfirmAction('close')}>
            Close Card
          </button>
        )}
      </div>

      {actionError && <p className="error-text mt-8">{actionError}</p>}

      <ConfirmDialog
        open={!!confirmAction}
        title={
          confirmAction === 'block' ? 'Block Card' :
          confirmAction === 'restore' ? 'Restore Card' :
          'Close Card'
        }
        confirmLabel={confirmAction === 'close' ? 'Close Card' : 'Confirm'}
        danger={confirmAction === 'close'}
        onConfirm={handleAction}
        onCancel={() => setConfirmAction(null)}
        loading={actionLoading}
      >
        <p>
          {confirmAction === 'block' && 'Are you sure you want to block this card? You can restore it later.'}
          {confirmAction === 'restore' && 'Are you sure you want to restore this card?'}
          {confirmAction === 'close' && 'Are you sure you want to close this card? The remaining balance will be refunded.'}
        </p>
      </ConfirmDialog>
    </div>
  );
}
