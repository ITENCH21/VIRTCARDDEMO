interface Props {
  value: string;
  onChange: (val: string) => void;
  label?: string;
  symbol?: string;
  placeholder?: string;
  error?: boolean;
  hint?: string;
  presets?: number[];
  currencyPrefix?: string;
}

export default function AmountInput({
  value,
  onChange,
  label = 'Amount',
  symbol = 'USDT',
  placeholder = '0.00',
  error = false,
  hint,
  presets,
  currencyPrefix = '$',
}: Props) {
  const numValue = parseFloat(value) || 0;

  return (
    <div style={{ marginBottom: 18 }}>
      {label && (
        <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 8 }}>
          {label}
        </label>
      )}

      {/* Large amount display */}
      {presets && (
        <div style={{ textAlign: 'center', padding: '20px 0 8px' }}>
          <div style={{ fontSize: 48, fontWeight: 700, letterSpacing: -2, color: 'var(--text-primary)', display: 'inline-block' }}>
            <span style={{ fontSize: 28, fontWeight: 500, color: 'var(--text-muted)', verticalAlign: 'super', marginRight: 2 }}>
              {currencyPrefix}
            </span>
            {numValue || 0}
          </div>
        </div>
      )}

      {/* Preset chips */}
      {presets && (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', margin: '16px 0 20px' }}>
            {presets.map((preset) => {
              const isSelected = numValue === preset && value !== '';
              return (
                <button
                  key={preset}
                  onClick={() => onChange(String(preset))}
                  style={{
                    padding: '10px 20px',
                    borderRadius: 24,
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'var(--transition-fast)',
                    WebkitTapHighlightColor: 'transparent',
                    minWidth: 72,
                    textAlign: 'center',
                    background: isSelected ? 'var(--accent-gradient)' : 'var(--bg-glass)',
                    border: isSelected ? '1.5px solid transparent' : '1.5px solid var(--border-glass)',
                    color: isSelected ? '#fff' : 'var(--text-secondary)',
                    boxShadow: isSelected ? '0 4px 16px rgba(99,102,241,0.25)' : 'none',
                  }}
                >
                  {currencyPrefix}{preset}
                </button>
              );
            })}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 16 }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>or enter custom:</span>
            <input
              type="number"
              value={presets.includes(numValue) ? '' : value}
              onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ''))}
              placeholder="0"
              style={{
                width: 120,
                padding: '10px 14px',
                background: 'var(--bg-glass)',
                border: '1px solid var(--border-glass)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
                fontSize: 16,
                fontWeight: 600,
                textAlign: 'center',
                outline: 'none',
                transition: 'var(--transition-fast)',
                MozAppearance: 'textfield' as never,
              }}
            />
          </div>
        </>
      )}

      {/* Classic input mode (no presets) */}
      {!presets && (
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            inputMode="decimal"
            value={value}
            onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ''))}
            placeholder={placeholder}
            className="form-input"
            style={{
              paddingRight: 60,
              borderColor: error ? 'var(--danger)' : undefined,
            }}
          />
          <span
            style={{
              position: 'absolute',
              right: 16,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
              fontSize: 14,
            }}
          >
            {symbol}
          </span>
        </div>
      )}

      {hint && (
        <p style={{ fontSize: 12, color: error ? 'var(--danger)' : 'var(--text-muted)', marginTop: 4 }}>
          {hint}
        </p>
      )}
    </div>
  );
}
