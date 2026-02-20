import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCard } from '../hooks/useCards';
import { fetchCardSensitive, blockCard, restoreCard, closeCard, CardSensitiveResponse } from '../api/cards';
import StatusBadge from '../components/StatusBadge';
import ConfirmDialog from '../components/ConfirmDialog';
import Spinner from '../components/Spinner';
import { formatAmount, formatCardNumber } from '../lib/format';
import { hapticFeedback } from '../lib/telegram';

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
      if (confirmAction === 'block') await blockCard(id);
      else if (confirmAction === 'restore') await restoreCard(id);
      else if (confirmAction === 'close') await closeCard(id);
      hapticFeedback('success');
      setConfirmAction(null);
      refresh();
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : 'Action failed');
      hapticFeedback('error');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <div className="page"><Spinner /></div>;
  if (error || !card) return <div className="page"><p className="error-text">{error || 'Card not found'}</p></div>;

  const isActive = card.status === 'A' || card.status === 'R';
  const isBlocked = card.status === 'L';
  const isClosed = card.status === 'C' || card.status === 'B';

  return (
    <div className="page">
      <h1 className="page-title">{card.name} ****{card.last4}</h1>

      <div className="card" style={{ textAlign: 'center', padding: '24px' }}>
        <StatusBadge status={card.status} />
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
        {!isClosed && (
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
