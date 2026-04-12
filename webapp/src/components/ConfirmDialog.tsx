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
      className="confirm-dialog-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 500,
        background: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        animation: 'fadeIn 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
      onClick={onCancel}
    >
      <div
        className="confirm-dialog-box"
        style={{
          width: '100%',
          maxWidth: 440,
          background: 'var(--modal-bg)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-xl)',
          padding: '28px 24px',
          boxShadow: 'var(--shadow-lg)',
          animation: 'fadeSlideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
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

      {/* Mobile: bottom sheet style */}
      <style>{`
        @media (max-width: 768px) {
          .confirm-dialog-overlay {
            align-items: flex-end !important;
            padding: 0 !important;
          }
          .confirm-dialog-box {
            max-width: 100% !important;
            border-radius: var(--radius-xl) var(--radius-xl) 0 0 !important;
            padding-bottom: calc(24px + var(--safe-bottom)) !important;
            animation: slideUp 0.4s cubic-bezier(0.4, 0, 0.2, 1) !important;
          }
        }
      `}</style>
    </div>
  );
}
