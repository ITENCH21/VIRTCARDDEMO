const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  A: { label: 'Active', color: 'var(--success-color)' },
  R: { label: 'Active', color: 'var(--success-color)' },
  L: { label: 'Blocked', color: 'var(--danger-color)' },
  B: { label: 'Banned', color: 'var(--danger-color)' },
  C: { label: 'Closed', color: 'var(--hint-color)' },
  D: { label: 'Draft', color: 'var(--warning-color)' },
  P: { label: 'Pending', color: 'var(--warning-color)' },
  O: { label: 'Processing', color: 'var(--link-color)' },
  F: { label: 'Failed', color: 'var(--danger-color)' },
  U: { label: 'Unknown', color: 'var(--hint-color)' },
};

interface Props {
  status: string;
  label?: string;
  color?: string;
}

export default function StatusBadge({ status, label, color }: Props) {
  const config = STATUS_CONFIG[status] || { label: status, color: 'var(--hint-color)' };
  const displayColor = color || config.color;

  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: '6px',
        fontSize: '12px',
        fontWeight: 600,
        color: displayColor,
        background: `${displayColor}20`,
      }}
    >
      {label || config.label}
    </span>
  );
}
