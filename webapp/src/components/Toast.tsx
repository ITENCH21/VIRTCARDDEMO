import { useEffect } from 'react';
import { CheckIcon, XIcon } from './icons';

interface Props {
  message: string;
  type: 'success' | 'error';
  onClose: () => void;
  duration?: number;
}

export default function Toast({ message, type, onClose, duration = 5000 }: Props) {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [onClose, duration]);

  const isSuccess = type === 'success';

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 20,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 600,
        maxWidth: 380,
        width: 'calc(100% - 40px)',
        padding: '14px 18px',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-glass)',
        borderRadius: 'var(--radius-md)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        boxShadow: 'var(--shadow-lg)',
        cursor: 'pointer',
        animation: 'toastSlideDown 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          background: isSuccess ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
          color: isSuccess ? 'var(--success)' : 'var(--danger)',
        }}
      >
        {isSuccess ? <CheckIcon size={16} /> : <XIcon size={16} />}
      </div>
      <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
        {message}
      </span>
    </div>
  );
}
