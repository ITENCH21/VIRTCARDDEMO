import { useLang } from '../contexts/LangContext';

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
  const { t } = useLang();

  return (
    <div
      style={{
        display: 'flex',
        gap: 8,
        overflowX: 'auto',
        paddingBottom: 4,
        marginBottom: 0,
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
        flexWrap: 'wrap',
      }}
    >
      {[{ value: '', label: t('all') }, ...options].map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            style={{
              flexShrink: 0,
              padding: '8px 18px',
              borderRadius: 12,
              fontSize: 13,
              fontWeight: 600,
              whiteSpace: 'nowrap',
              cursor: 'pointer',
              transition: 'var(--transition-fast)',
              WebkitTapHighlightColor: 'transparent',
              background: active ? 'var(--accent-gradient)' : 'var(--bg-input)',
              border: active ? '1px solid transparent' : 'none',
              color: active ? '#fff' : 'var(--text-secondary)',
              boxShadow: active ? '0 4px 16px rgba(59,130,246,0.25)' : 'var(--shadow-inset)',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
