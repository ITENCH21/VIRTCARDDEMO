interface Props {
  size?: number;
  label?: string;
  sublabel?: string;
}

export default function Spinner({ size = 32, label, sublabel }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div
        style={{
          width: size,
          height: size,
          border: '3px solid rgba(99,102,241,0.15)',
          borderTopColor: 'var(--accent-1)',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }}
      />
      {label && (
        <div style={{ fontSize: 17, fontWeight: 600, marginTop: 20, color: 'var(--text-primary)' }}>
          {label}
        </div>
      )}
      {sublabel && (
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6 }}>
          {sublabel}
        </div>
      )}
    </div>
  );
}
