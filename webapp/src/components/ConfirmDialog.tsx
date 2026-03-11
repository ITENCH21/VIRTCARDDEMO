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
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 500,
        background: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        animation: 'fadeIn 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
      onClick={onCancel}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 430,
          background: 'var(--modal-bg)',
          border: '1px solid var(--border-glass)',
          borderTopLeftRadius: 'var(--radius-xl)',
          borderTopRightRadius: 'var(--radius-xl)',
          borderBottomLeftRadius: 0,
          borderBottomRightRadius: 0,
          padding: '24px 20px',
          paddingBottom: 'calc(24px + var(--safe-bottom))',
          animation: 'slideUp 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div
          style={{
            width: 36,
            height: 4,
            background: 'var(--text-muted)',
            opacity: 0.3,
            borderRadius: 2,
            margin: '0 auto 20px',
          }}
        />

        <h3
          style={{
            fontSize: 18,
            fontWeight: 700,
            textAlign: 'center',
            marginBottom: 8,
            color: 'var(--text-primary)',
          }}
        >
          {title}
        </h3>

        <div
          style={{
            fontSize: 14,
            color: 'var(--text-secondary)',
            textAlign: 'center',
            marginBottom: 24,
            lineHeight: 1.5,
          }}
        >
          {children}
        </div>

        <button
          className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
          onClick={onConfirm}
          disabled={loading}
        >
          {loading ? 'Loading...' : confirmLabel}
        </button>
        <div style={{ height: 8 }} />
        <button className="btn btn-secondary" onClick={onCancel} disabled={loading}>
          {cancelLabel}
        </button>
      </div>
    </div>
  );
}
