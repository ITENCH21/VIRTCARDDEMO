interface Props {
  value: string;
  onChange: (val: string) => void;
  label?: string;
  symbol?: string;
  placeholder?: string;
}

export default function AmountInput({
  value,
  onChange,
  label = 'Amount',
  symbol = 'USDT',
  placeholder = '0.00',
}: Props) {
  return (
    <div className="input-group">
      <label>{label}</label>
      <div style={{ position: 'relative' }}>
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => {
            const val = e.target.value.replace(/[^0-9.]/g, '');
            onChange(val);
          }}
          placeholder={placeholder}
          style={{ paddingRight: '60px' }}
        />
        <span
          style={{
            position: 'absolute',
            right: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--hint-color)',
            fontSize: '14px',
          }}
        >
          {symbol}
        </span>
      </div>
    </div>
  );
}
