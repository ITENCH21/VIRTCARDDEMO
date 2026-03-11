const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  A: { label: 'Active', bg: 'rgba(16,185,129,0.12)', color: 'var(--success)' },
  R: { label: 'Active', bg: 'rgba(16,185,129,0.12)', color: 'var(--success)' },
  L: { label: 'Blocked', bg: 'rgba(239,68,68,0.12)', color: 'var(--danger)' },
  B: { label: 'Banned', bg: 'rgba(239,68,68,0.12)', color: 'var(--danger)' },
  C: { label: 'Complete', bg: 'rgba(16,185,129,0.12)', color: 'var(--success)' },
  D: { label: 'Draft', bg: 'rgba(245,158,11,0.12)', color: 'var(--warning)' },
  P: { label: 'Pending', bg: 'rgba(245,158,11,0.12)', color: 'var(--warning)' },
  O: { label: 'Processing', bg: 'rgba(59,130,246,0.12)', color: 'var(--info)' },
  F: { label: 'Failed', bg: 'rgba(239,68,68,0.12)', color: 'var(--danger)' },
  U: { label: 'Unknown', bg: 'rgba(100,116,139,0.12)', color: 'var(--text-muted)' },
};

interface Props {
  status: string;
  label?: string;
  color?: string;
}

export default function StatusBadge({ status, label, color }: Props) {
  const config = STATUS_CONFIG[status] || { label: status, bg: 'rgba(100,116,139,0.12)', color: 'var(--text-muted)' };
  const displayColor = color || config.color;

  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 6,
        fontSize: 11,
        fontWeight: 600,
        color: displayColor,
        background: config.bg,
      }}
    >
      {label || config.label}
    </span>
  );
}
