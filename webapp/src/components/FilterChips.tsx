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
        gap: 8,
        overflowX: 'auto',
        paddingBottom: 4,
        marginBottom: 16,
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
      }}
    >
      {[{ value: '', label: 'Все' }, ...options].map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            style={{
              flexShrink: 0,
              padding: '8px 16px',
              borderRadius: 20,
              fontSize: 13,
              fontWeight: 500,
              whiteSpace: 'nowrap',
              cursor: 'pointer',
              transition: 'var(--transition-fast)',
              WebkitTapHighlightColor: 'transparent',
              background: active ? 'var(--accent-gradient)' : 'var(--bg-glass)',
              border: active ? '1px solid transparent' : '1px solid var(--border-glass)',
              color: active ? '#fff' : 'var(--text-secondary)',
              boxShadow: active ? '0 4px 16px rgba(99,102,241,0.25)' : 'none',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
