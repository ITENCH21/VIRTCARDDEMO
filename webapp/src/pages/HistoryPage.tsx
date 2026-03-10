import { useOperations } from '../hooks/useOperations';
import OperationListItem from '../components/OperationListItem';
import FilterChips from '../components/FilterChips';
import Spinner from '../components/Spinner';

const KIND_OPTIONS = [
  { value: 'DE', label: 'Deposit' },
  { value: 'WI', label: 'Withdrawal' },
  { value: 'CO', label: 'Card Issue' },
  { value: 'CT', label: 'Card Topup' },
  { value: 'CB', label: 'Card Block' },
  { value: 'CR', label: 'Card Restore' },
  { value: 'CC', label: 'Card Close' },
];

const STATUS_OPTIONS = [
  { value: 'P', label: 'Pending' },
  { value: 'O', label: 'Processing' },
  { value: 'C', label: 'Complete' },
  { value: 'F', label: 'Failed' },
];

export default function HistoryPage() {
  const { items, total, loading, error, filters, hasNext, hasPrev, nextPage, prevPage, applyFilters } = useOperations();

  return (
    <div className="page">
      <h1 className="page-title">History</h1>

      <div className="mb-8">
        <div className="text-hint mb-8" style={{ fontSize: '12px' }}>Type</div>
        <FilterChips
          options={KIND_OPTIONS}
          value={filters.kind || ''}
          onChange={(kind) => applyFilters({ ...filters, kind: kind || undefined })}
        />
      </div>
      <div className="mb-16">
        <div className="text-hint mb-8" style={{ fontSize: '12px' }}>Status</div>
        <FilterChips
          options={STATUS_OPTIONS}
          value={filters.status || ''}
          onChange={(status) => applyFilters({ ...filters, status: status || undefined })}
        />
      </div>

      {loading && <Spinner />}
      {error && <p className="error-text">{error}</p>}

      {!loading && items.length === 0 && (
        <p className="text-hint text-center mt-24">No operations yet</p>
      )}

      {items.map((op) => (
        <OperationListItem key={op.id} operation={op} />
      ))}

      {(hasPrev || hasNext) && (
        <div className="flex-between mt-16">
          <button
            className="btn btn-secondary"
            style={{ width: 'auto', padding: '8px 16px' }}
            onClick={prevPage}
            disabled={!hasPrev}
          >
            Previous
          </button>
          <span className="text-hint">{total} total</span>
          <button
            className="btn btn-secondary"
            style={{ width: 'auto', padding: '8px 16px' }}
            onClick={nextPage}
            disabled={!hasNext}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
