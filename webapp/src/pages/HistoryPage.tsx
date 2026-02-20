import { useOperations } from '../hooks/useOperations';
import OperationListItem from '../components/OperationListItem';
import Spinner from '../components/Spinner';

export default function HistoryPage() {
  const { items, total, loading, error, hasNext, hasPrev, nextPage, prevPage } = useOperations();

  return (
    <div className="page">
      <h1 className="page-title">History</h1>

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
