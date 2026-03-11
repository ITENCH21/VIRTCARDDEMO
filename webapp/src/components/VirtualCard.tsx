interface Props {
  name?: string;
  last4: string;
  balance: string;
  currencySymbol: string;
  variant?: number;
  onClick?: () => void;
}

const GRADIENTS = [
  'linear-gradient(135deg, #6366f1, #8b5cf6, #a78bfa)',
  'linear-gradient(135deg, #06b6d4, #3b82f6, #6366f1)',
  'linear-gradient(135deg, #ec4899, #8b5cf6, #6366f1)',
];

export default function VirtualCard({ name, last4, balance, currencySymbol, variant = 0, onClick }: Props) {
  const gradient = GRADIENTS[variant % GRADIENTS.length];

  return (
    <div
      onClick={onClick}
      style={{
        width: '100%',
        aspectRatio: '1.6 / 1',
        borderRadius: 'var(--radius-xl)',
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        position: 'relative',
        overflow: 'hidden',
        cursor: onClick ? 'pointer' : undefined,
        transition: 'var(--transition-normal)',
        background: gradient,
      }}
    >
      {/* Decorative orbs */}
      <div style={{
        position: 'absolute', top: '-30%', right: '-20%', width: 200, height: 200,
        background: 'radial-gradient(circle, rgba(255,255,255,0.1), transparent 70%)', borderRadius: '50%',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: '-20%', left: '-10%', width: 150, height: 150,
        background: 'radial-gradient(circle, rgba(255,255,255,0.05), transparent 70%)', borderRadius: '50%',
        pointerEvents: 'none',
      }} />

      {/* Top: Brand + badge */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 1 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', letterSpacing: 1 }}>YeezyPay</div>
          <div style={{ height: 8 }} />
          {/* Chip */}
          <div style={{
            width: 36, height: 28,
            background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
            borderRadius: 6, opacity: 0.9,
          }} />
        </div>
        <div style={{
          fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.8)',
          background: 'rgba(255,255,255,0.15)', padding: '3px 10px', borderRadius: 20,
          textTransform: 'uppercase', letterSpacing: 0.5,
        }}>
          Virtual
        </div>
      </div>

      {/* Number */}
      <div style={{
        fontSize: 16, fontWeight: 500, color: 'rgba(255,255,255,0.9)',
        letterSpacing: 3, fontFamily: "'SF Mono','Menlo',monospace",
        position: 'relative', zIndex: 1,
      }}>
        &bull;&bull;&bull;&bull; &bull;&bull;&bull;&bull; &bull;&bull;&bull;&bull; {last4}
      </div>

      {/* Bottom: Name + Balance */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', position: 'relative', zIndex: 1 }}>
        <div>
          <div style={{ fontSize: 11, textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)', letterSpacing: 1 }}>Card Holder</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginTop: 2 }}>{name || 'Card'}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', textAlign: 'right' }}>Balance</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginTop: 2 }}>
            {currencySymbol}{balance}
          </div>
        </div>
      </div>
    </div>
  );
}
