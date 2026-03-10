interface FilterOption {
  value: string;
  label: string;
}

interface Props {
  options: FilterOption[];
  value: string;
  onChange: (value: string) => void;
}

export default function FilterChips({ options, value, onChange }: Props) {
  return (
    <div
      style={{
        display: 'flex',
        gap: '6px',
        overflowX: 'auto',
        paddingBottom: '4px',
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
      }}
    >
      {[{ value: '', label: 'All' }, ...options].map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            style={{
              flexShrink: 0,
              padding: '6px 12px',
              borderRadius: '16px',
              fontSize: '13px',
              fontWeight: 500,
              border: active ? 'none' : '1px solid var(--border-color)',
              background: active ? 'var(--button-color)' : 'transparent',
              color: active ? 'var(--button-text-color)' : 'var(--text-color)',
              transition: 'all 0.15s',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
