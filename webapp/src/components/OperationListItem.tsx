import { OperationResponse } from '../api/operations';
import StatusBadge from './StatusBadge';
import { formatAmount, formatDate } from '../lib/format';

const OP_STATUS: Record<string, { label: string; color: string }> = {
  P: { label: 'Pending', color: 'var(--warning-color)' },
  O: { label: 'Processing', color: 'var(--link-color)' },
  C: { label: 'Complete', color: 'var(--success-color)' },
  F: { label: 'Failed', color: 'var(--danger-color)' },
  U: { label: 'Unknown', color: 'var(--hint-color)' },
};

interface Props {
  operation: OperationResponse;
}

export default function OperationListItem({ operation }: Props) {
  const opStatus = OP_STATUS[operation.status];

  return (
    <div className="card">
      <div className="flex-between">
        <div>
          <div style={{ fontWeight: 600, fontSize: '14px' }}>{operation.kind_label}</div>
          <div className="text-hint" style={{ fontSize: '12px' }}>
            {formatDate(operation.created_at)}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontWeight: 600 }}>
            {formatAmount(operation.amount, operation.currency_symbol)}
          </div>
          <StatusBadge
            status={operation.status}
            label={opStatus?.label}
            color={opStatus?.color}
          />
        </div>
      </div>
    </div>
  );
}
