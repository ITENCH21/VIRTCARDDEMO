import { useOperations } from '../hooks/useOperations';
import OperationListItem from '../components/OperationListItem';
import FilterChips from '../components/FilterChips';
import Spinner from '../components/Spinner';
import { ChevronLeftIcon, ChevronRightIcon } from '../components/icons';

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

      {/* Type Filter */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Type</div>
        <FilterChips
          options={KIND_OPTIONS}
          value={filters.kind || ''}
          onChange={(kind) => applyFilters({ ...filters, kind: kind || undefined })}
        />
      </div>

      {/* Status Filter */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Status</div>
        <FilterChips
          options={STATUS_OPTIONS}
          value={filters.status || ''}
          onChange={(status) => applyFilters({ ...filters, status: status || undefined })}
        />
      </div>

      {loading && <Spinner />}
      {error && <p className="error-text">{error}</p>}

      {!loading && items.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: 15 }}>No operations yet</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map((op) => (
          <OperationListItem key={op.id} operation={op} />
        ))}
      </div>

      {/* Pagination */}
      {(hasPrev || hasNext) && (
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginTop: 20, padding: '12px 0',
        }}>
          <button
            onClick={prevPage}
            disabled={!hasPrev}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '8px 16px', borderRadius: 'var(--radius-md)',
              background: hasPrev ? 'var(--bg-glass)' : 'transparent',
              border: hasPrev ? '1px solid var(--border-glass)' : '1px solid transparent',
              color: hasPrev ? 'var(--text-primary)' : 'var(--text-muted)',
              cursor: hasPrev ? 'pointer' : 'default',
              fontSize: 14, fontWeight: 500,
              opacity: hasPrev ? 1 : 0.4,
            }}
          >
            <ChevronLeftIcon size={16} /> Prev
          </button>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{total} total</span>
          <button
            onClick={nextPage}
            disabled={!hasNext}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '8px 16px', borderRadius: 'var(--radius-md)',
              background: hasNext ? 'var(--bg-glass)' : 'transparent',
              border: hasNext ? '1px solid var(--border-glass)' : '1px solid transparent',
              color: hasNext ? 'var(--text-primary)' : 'var(--text-muted)',
              cursor: hasNext ? 'pointer' : 'default',
              fontSize: 14, fontWeight: 500,
              opacity: hasNext ? 1 : 0.4,
            }}
          >
            Next <ChevronRightIcon size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
