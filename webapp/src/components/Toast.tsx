import { useEffect } from 'react';

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

  const bgColor = type === 'success' ? 'var(--success-color, #28a745)' : 'var(--danger-color, #dc3545)';

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        top: '16px',
        left: '16px',
        right: '16px',
        padding: '12px 16px',
        background: bgColor,
        color: '#fff',
        borderRadius: '8px',
        fontSize: '14px',
        fontWeight: 500,
        zIndex: 1000,
        cursor: 'pointer',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        animation: 'toast-slide-in 0.3s ease-out',
      }}
    >
      {message}
    </div>
  );
}
