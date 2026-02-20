import { OperationResponse } from '../api/operations';
import StatusBadge from './StatusBadge';
import { formatAmount, formatDate } from '../lib/format';

interface Props {
  operation: OperationResponse;
}

export default function OperationListItem({ operation }: Props) {
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
          <StatusBadge status={operation.status} />
        </div>
      </div>
    </div>
  );
}
