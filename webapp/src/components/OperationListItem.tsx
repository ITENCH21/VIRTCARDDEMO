import { OperationResponse } from '../api/operations';
import StatusBadge from './StatusBadge';
import { ArrowDownIcon, ArrowUpIcon, CreditCardIcon, LockIcon, PlusIcon, XIcon } from './icons';
import { formatAmount, formatDate } from '../lib/format';
import { useLang } from '../contexts/LangContext';

function getIconConfig(kind: string) {
  const k = kind.toLowerCase();
  if (k.includes('deposit')) return { Icon: ArrowDownIcon, bg: 'rgba(16,185,129,0.12)', color: '#10b981' };
  if (k.includes('withdraw')) return { Icon: ArrowUpIcon, bg: 'rgba(239,68,68,0.12)', color: '#ef4444' };
  if (k.includes('block') || k.includes('restore')) return { Icon: LockIcon, bg: 'rgba(245,158,11,0.12)', color: '#f59e0b' };
  if (k.includes('close')) return { Icon: XIcon, bg: 'rgba(100,116,139,0.12)', color: '#64748b' };
  if (k.includes('open') || k.includes('issue')) return { Icon: PlusIcon, bg: 'rgba(99,102,241,0.12)', color: '#6366f1' };
  return { Icon: CreditCardIcon, bg: 'rgba(99,102,241,0.12)', color: '#6366f1' };
}

function isPositive(kind: string): boolean {
  return kind.toLowerCase().includes('deposit');
}

interface Props {
  operation: OperationResponse;
  borderless?: boolean;
}

export default function OperationListItem({ operation, borderless }: Props) {
  const { t } = useLang();
  const { Icon, bg, color } = getIconConfig(operation.kind);
  const positive = isPositive(operation.kind);
  const statusKey = `status_${operation.status}` as Parameters<typeof t>[0];
  const statusLabel = t(statusKey);
  const kindKey = `kind_${operation.kind}` as Parameters<typeof t>[0];
  const kindLabel = kindKey in { kind_DE: 1, kind_WI: 1, kind_CO: 1, kind_CT: 1, kind_CB: 1, kind_CR: 1, kind_CC: 1 }
    ? t(kindKey)
    : operation.kind_label;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: borderless ? '14px 0' : 16,
        borderBottom: borderless ? '1px solid var(--tx-border)' : undefined,
        background: borderless ? 'transparent' : 'var(--bg-glass)',
        border: borderless ? undefined : '1px solid var(--border-glass)',
        borderRadius: borderless ? 0 : 'var(--radius-md)',
        marginBottom: borderless ? 0 : 10,
        transition: 'var(--transition-fast)',
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          background: bg,
          color,
        }}
      >
        <Icon size={18} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
          {kindLabel}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
          {formatDate(operation.created_at)}
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: positive ? 'var(--success)' : 'var(--text-primary)',
          }}
        >
          {positive ? '+' : ''}{formatAmount(operation.amount, operation.currency_symbol)}
        </div>
        <div style={{ marginTop: 3 }}>
          <StatusBadge status={operation.status} label={statusLabel} />
        </div>
      </div>
    </div>
  );
}
