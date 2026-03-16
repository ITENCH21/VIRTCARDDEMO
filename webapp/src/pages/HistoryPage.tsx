import { useOperations } from '../hooks/useOperations';
import OperationListItem from '../components/OperationListItem';
import FilterChips from '../components/FilterChips';
import Spinner from '../components/Spinner';
import { ChevronLeftIcon, ChevronRightIcon } from '../components/icons';
import { useLang } from '../contexts/LangContext';

export default function HistoryPage() {
  const { items, total, loading, error, filters, hasNext, hasPrev, nextPage, prevPage, applyFilters } = useOperations();
  const { t } = useLang();

  const KIND_OPTIONS = [
    { value: 'DE', label: t('kind_DE') },
    { value: 'WI', label: t('kind_WI') },
    { value: 'CO', label: t('kind_CO') },
    { value: 'CT', label: t('kind_CT') },
    { value: 'CB', label: t('kind_CB') },
    { value: 'CR', label: t('kind_CR') },
    { value: 'CC', label: t('kind_CC') },
  ];

  const STATUS_OPTIONS = [
    { value: 'P', label: t('status_P') },
    { value: 'O', label: t('status_O') },
    { value: 'C', label: t('status_C') },
    { value: 'F', label: t('status_F') },
  ];

  return (
    <div className="page">
      {/* Type Filter */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>{t('filter_type')}</div>
        <FilterChips
          options={KIND_OPTIONS}
          value={filters.kind || ''}
          onChange={(kind) => applyFilters({ ...filters, kind: kind || undefined })}
        />
      </div>

      {/* Status Filter */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>{t('filter_status')}</div>
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
          <p style={{ color: 'var(--text-muted)', fontSize: 15 }}>{t('no_ops')}</p>
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
            <ChevronLeftIcon size={16} /> {t('prev')}
          </button>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{total} {t('total')}</span>
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
            {t('next')} <ChevronRightIcon size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
