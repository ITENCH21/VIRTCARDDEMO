import Spinner from './Spinner';
import { RefreshIcon, CheckIcon, XIcon } from './icons';

interface Props {
  isPolling: boolean;
  isComplete: boolean;
  isFailed: boolean;
  timedOut?: boolean;
  onSync?: () => void;
  syncing?: boolean;
  syncMessage?: string;
}

export default function PollingScreen({
  isPolling,
  isComplete,
  isFailed,
  timedOut,
  onSync,
  syncing,
  syncMessage,
}: Props) {
  if (isComplete) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 20px' }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%', margin: '0 auto 20px',
          background: 'rgba(16,185,129,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--success)',
        }}>
          <CheckIcon size={28} />
        </div>
        <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)' }}>
          Operation Complete
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6 }}>
          Your request has been processed successfully.
        </div>
      </div>
    );
  }

  if (isFailed) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 20px' }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%', margin: '0 auto 20px',
          background: 'rgba(239,68,68,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--danger)',
        }}>
          <XIcon size={28} />
        </div>
        <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)' }}>
          Operation Failed
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6 }}>
          Something went wrong. Please try again.
        </div>
      </div>
    );
  }

  return (
    <div style={{ textAlign: 'center', padding: '40px 20px' }}>
      <Spinner size={56} label="Processing your request..." sublabel="This usually takes a few seconds." />
      {isPolling && (
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 16 }}>
          Checking status...
        </div>
      )}
      {timedOut && onSync && (
        <div style={{ marginTop: 24 }}>
          {syncMessage && (
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
              {syncMessage}
            </div>
          )}
          <button className="btn btn-secondary" onClick={onSync} disabled={syncing}>
            <RefreshIcon size={18} />
            {syncing ? 'Syncing...' : 'Sync Status'}
          </button>
        </div>
      )}
    </div>
  );
}
