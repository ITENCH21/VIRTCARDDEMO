import { ReactNode } from 'react';

interface Props {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
  danger?: boolean;
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 200,
  padding: '16px',
};

const dialogStyle: React.CSSProperties = {
  background: 'var(--card-bg)',
  borderRadius: '16px',
  padding: '24px',
  width: '100%',
  maxWidth: '360px',
};

export default function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  loading = false,
  danger = false,
}: Props) {
  if (!open) return null;

  return (
    <div style={overlayStyle} onClick={onCancel}>
      <div style={dialogStyle} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '12px' }}>
          {title}
        </h3>
        <div style={{ marginBottom: '20px' }}>{children}</div>
        <div className="flex gap-8">
          <button className="btn btn-secondary" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </button>
          <button
            className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? 'Loading...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
