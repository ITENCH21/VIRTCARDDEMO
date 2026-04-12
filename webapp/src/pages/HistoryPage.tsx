import { useMemo } from 'react';
import { useOperations, Period } from '../hooks/useOperations';
import OperationListItem from '../components/OperationListItem';
import StatusBadge from '../components/StatusBadge';
import FilterChips from '../components/FilterChips';
import Spinner from '../components/Spinner';
import { ChevronLeftIcon, ChevronRightIcon } from '../components/icons';
import { formatAmount, formatDate } from '../lib/format';
import { useLang } from '../contexts/LangContext';
import { useLayout } from '../contexts/LayoutContext';

const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function getIconConfig(kind: string) {
  const k = kind.toLowerCase();
  if (k.includes('de')) return { bg: 'rgba(16,185,129,0.12)', color: '#10b981', arrow: '↓' };
  if (k.includes('wi')) return { bg: 'rgba(239,68,68,0.12)', color: '#ef4444', arrow: '↑' };
  if (k.includes('ct')) return { bg: 'rgba(59,130,246,0.12)', color: '#3b82f6', arrow: '→' };
  if (k.includes('cb') || k.includes('cr')) return { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b', arrow: '⊘' };
  return { bg: 'rgba(99,102,241,0.12)', color: '#6366f1', arrow: '•' };
}

export default function HistoryPage() {
  const {
    items, total, loading, error, filters, period,
    hasNext, hasPrev, nextPage, prevPage,
    applyFilters, applyPeriod, allFiltered, totalFromApi,
  } = useOperations(15);
  const { t } = useLang();
  const { isDesktop } = useLayout();

  // Stats computed from all filtered items
  const stats = useMemo(() => {
    let deposited = 0;
    let withdrawn = 0;
    let onCards = 0;
    let count = 0;
    for (const op of allFiltered) {
      if (op.status !== 'C') continue; // only completed
      const amount = parseFloat(op.amount) || 0;
      if (op.kind === 'DE') deposited += amount;
      else if (op.kind === 'WI') withdrawn += amount;
      else if (op.kind === 'CT') onCards += amount;
      count++;
    }
    return { deposited, withdrawn, onCards, count, total: allFiltered.length };
  }, [allFiltered]);

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

  const PERIODS: { value: Period; label: string }[] = [
    { value: 'today', label: t('period_today') },
    { value: 'yesterday', label: t('period_yesterday') },
    { value: 'week', label: t('period_week') },
    { value: 'month', label: t('period_month') },
    { value: 'all', label: t('period_all') },
  ];

  const PaginationBar = () => (hasPrev || hasNext) ? (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      marginTop: 20, padding: '12px 0',
    }}>
      <button onClick={prevPage} disabled={!hasPrev} style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '10px 20px', borderRadius: 'var(--radius-md)',
        background: hasPrev ? 'var(--bg-card)' : 'transparent',
        border: hasPrev ? '1px solid var(--border)' : '1px solid transparent',
        color: hasPrev ? 'var(--text-primary)' : 'var(--text-muted)',
        cursor: hasPrev ? 'pointer' : 'default',
        fontSize: 14, fontWeight: 500, opacity: hasPrev ? 1 : 0.4,
      }}>
        <ChevronLeftIcon size={16} /> {t('prev')}
      </button>
      <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>
        {total} {t('total')}
      </span>
      <button onClick={nextPage} disabled={!hasNext} style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '10px 20px', borderRadius: 'var(--radius-md)',
        background: hasNext ? 'var(--bg-card)' : 'transparent',
        border: hasNext ? '1px solid var(--border)' : '1px solid transparent',
        color: hasNext ? 'var(--text-primary)' : 'var(--text-muted)',
        cursor: hasNext ? 'pointer' : 'default',
        fontSize: 14, fontWeight: 500, opacity: hasNext ? 1 : 0.4,
      }}>
        {t('next')} <ChevronRightIcon size={16} />
      </button>
    </div>
  ) : null;

  return (
    <div className="page">
      {/* ── Period Tabs ── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {PERIODS.map((p) => {
            const active = period === p.value;
            return (
              <button key={p.value} onClick={() => applyPeriod(p.value)} style={{
                padding: '8px 18px', borderRadius: 12, fontSize: 13, fontWeight: 600,
                cursor: 'pointer', transition: 'var(--transition-fast)',
                background: active ? 'var(--accent-gradient)' : 'var(--bg-input)',
                border: 'none',
                color: active ? '#fff' : 'var(--text-secondary)',
                boxShadow: active ? '0 4px 16px rgba(59,130,246,0.25)' : 'var(--shadow-inset)',
              }}>
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Summary Stats ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isDesktop ? 'repeat(4, 1fr)' : 'repeat(2, 1fr)',
        gap: 12, marginBottom: 24,
      }}>
        <div className="stat-widget" style={{}}>
          <div className="stat-widget-label">{t('stat_deposited')}</div>
          <div className="stat-widget-value" style={{ fontSize: 20, color: 'var(--success)' }}>
            +{fmt(stats.deposited)}
          </div>
        </div>
        <div className="stat-widget" style={{}}>
          <div className="stat-widget-label">{t('stat_withdrawn')}</div>
          <div className="stat-widget-value" style={{ fontSize: 20, color: 'var(--danger)' }}>
            -{fmt(stats.withdrawn)}
          </div>
        </div>
        <div className="stat-widget" style={{}}>
          <div className="stat-widget-label">{t('stat_on_cards')}</div>
          <div className="stat-widget-value" style={{ fontSize: 20, color: 'var(--accent-1)' }}>
            {fmt(stats.onCards)}
          </div>
        </div>
        <div className="stat-widget" style={{}}>
          <div className="stat-widget-label">{t('stat_operations')}</div>
          <div className="stat-widget-value" style={{ fontSize: 20 }}>
            {stats.total}
          </div>
          {totalFromApi > 200 && (
            <div className="stat-widget-sub" style={{ color: 'var(--text-muted)' }}>
              {totalFromApi} {t('total')}
            </div>
          )}
        </div>
      </div>

      {/* ── Kind + Status Filters ── */}
      <div style={{
        display: 'flex', gap: 24, marginBottom: 20, flexWrap: 'wrap',
        alignItems: 'flex-start',
      }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {t('filter_type')}
          </div>
          <FilterChips
            options={KIND_OPTIONS}
            value={filters.kind || ''}
            onChange={(kind) => applyFilters({ ...filters, kind: kind || undefined })}
          />
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {t('filter_status')}
          </div>
          <FilterChips
            options={STATUS_OPTIONS}
            value={filters.status || ''}
            onChange={(status) => applyFilters({ ...filters, status: status || undefined })}
          />
        </div>
      </div>

      {loading && <Spinner />}
      {error && <p className="error-text">{error}</p>}

      {!loading && items.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: 15 }}>{t('no_ops')}</p>
        </div>
      )}

      {/* ── Desktop Table ── */}
      {items.length > 0 && (
        <>
          <div className="history-desktop-table">
            <table className="desktop-table">
              <thead>
                <tr>
                  <th>{t('filter_type')}</th>
                  <th>{t('amount_label')}</th>
                  <th>{t('filter_status')}</th>
                  <th style={{ textAlign: 'right' }}>{t('date_col')}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((op) => {
                  const kindKey = `kind_${op.kind}` as Parameters<typeof t>[0];
                  const kindLabel = kindKey in { kind_DE: 1, kind_WI: 1, kind_CO: 1, kind_CT: 1, kind_CB: 1, kind_CR: 1, kind_CC: 1 }
                    ? t(kindKey) : op.kind_label;
                  const statusKey = `status_${op.status}` as Parameters<typeof t>[0];
                  const statusLabel = t(statusKey);
                  const isPositive = op.kind === 'DE';
                  const ic = getIconConfig(op.kind);
                  return (
                    <tr key={op.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{
                            width: 32, height: 32, borderRadius: 8,
                            background: ic.bg, color: ic.color,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0, fontSize: 14, fontWeight: 600,
                          }}>
                            {ic.arrow}
                          </div>
                          <span style={{ fontWeight: 500 }}>{kindLabel}</span>
                        </div>
                      </td>
                      <td style={{
                        fontWeight: 600,
                        color: isPositive ? 'var(--success)' : 'var(--text-primary)',
                      }}>
                        {isPositive ? '+' : ''}{formatAmount(op.amount, op.currency_symbol)}
                      </td>
                      <td><StatusBadge status={op.status} label={statusLabel} /></td>
                      <td style={{ textAlign: 'right', color: 'var(--text-muted)', fontSize: 13 }}>
                        {formatDate(op.created_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ── Mobile List ── */}
          <div className="history-mobile-list">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {items.map((op) => (
                <OperationListItem key={op.id} operation={op} />
              ))}
            </div>
          </div>

          <style>{`
            @media (min-width: 769px) {
              .history-mobile-list { display: none; }
            }
            @media (max-width: 768px) {
              .history-desktop-table { display: none; }
            }
          `}</style>
        </>
      )}

      <PaginationBar />
    </div>
  );
}
