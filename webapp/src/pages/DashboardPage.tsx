import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useBalance } from '../hooks/useBalance';
import { useCards } from '../hooks/useCards';
import { fetchOperations, OperationResponse } from '../api/operations';
import { CardResponse } from '../api/cards';
import Spinner from '../components/Spinner';
import VirtualCard from '../components/VirtualCard';
import OperationListItem from '../components/OperationListItem';
import { ArrowDownIcon, ArrowUpIcon, PlusIcon, CreditCardIcon, EyeIcon, ClockIcon } from '../components/icons';
import { formatAmount } from '../lib/format';
import { useLang } from '../contexts/LangContext';
import { useTheme } from '../contexts/ThemeContext';

type HeroColor = { g: string; s: string };

// Dark theme — near-black atmospheric gradients
const HERO_COLORS_DARK: HeroColor[] = [
  { g: 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)', s: '#302b63' },
  { g: 'linear-gradient(135deg, #141e30, #243b55, #0a1628)', s: '#243b55' },
  { g: 'linear-gradient(135deg, #0f2027, #203a43, #2c5364)', s: '#203a43' },
  { g: 'linear-gradient(135deg, #001845, #001f54, #00356b)', s: '#001f54' },
  { g: 'linear-gradient(135deg, #1a0533, #3d0e6d, #5c1a9a)', s: '#3d0e6d' },
  { g: 'linear-gradient(135deg, #1a001a, #4a004a, #6b006b)', s: '#4a004a' },
  { g: 'linear-gradient(135deg, #001a00, #003d24, #005c35)', s: '#003d24' },
  { g: 'linear-gradient(135deg, #0a1f0a, #1a3d1a, #145214)', s: '#1a3d1a' },
  { g: 'linear-gradient(135deg, #1a0000, #4d0000, #730000)', s: '#4d0000' },
  { g: 'linear-gradient(135deg, #1a0010, #4a0030, #6b0045)', s: '#4a0030' },
  { g: 'linear-gradient(135deg, #0f172a, #1e293b, #334155)', s: '#334155' },
  { g: 'linear-gradient(135deg, #000000, #0a0a1a, #141428)', s: '#0a0a1a' },
  { g: 'linear-gradient(135deg, #1a1a1a, #2a2a3a, #3a3a4a)', s: '#2a2a3a' },
  { g: 'linear-gradient(135deg, #1a0a00, #4d2200, #734400)', s: '#4d2200' },
  { g: 'linear-gradient(135deg, #001a1a, #003d3d, #005c5c)', s: '#003d3d' },
  { g: 'linear-gradient(135deg, #0a0a0f, #1a1a2e, #16213e)', s: '#1a1a2e' },
];

// Light theme — medium-rich vivid gradients, dark enough for white text
const HERO_COLORS_LIGHT: HeroColor[] = [
  { g: 'linear-gradient(135deg, #1e3a8a, #1d4ed8, #3b82f6)', s: '#1d4ed8' },
  { g: 'linear-gradient(135deg, #0c4a6e, #0369a1, #0ea5e9)', s: '#0369a1' },
  { g: 'linear-gradient(135deg, #1e1b4b, #3730a3, #4f46e5)', s: '#3730a3' },
  { g: 'linear-gradient(135deg, #4c1d95, #6d28d9, #7c3aed)', s: '#6d28d9' },
  { g: 'linear-gradient(135deg, #3b0764, #7e22ce, #a855f7)', s: '#7e22ce' },
  { g: 'linear-gradient(135deg, #831843, #be185d, #db2777)', s: '#be185d' },
  { g: 'linear-gradient(135deg, #7f1d1d, #b91c1c, #dc2626)', s: '#b91c1c' },
  { g: 'linear-gradient(135deg, #78350f, #b45309, #d97706)', s: '#b45309' },
  { g: 'linear-gradient(135deg, #7c2d12, #c2410c, #ea580c)', s: '#c2410c' },
  { g: 'linear-gradient(135deg, #14532d, #15803d, #16a34a)', s: '#15803d' },
  { g: 'linear-gradient(135deg, #134e4a, #0f766e, #0d9488)', s: '#0f766e' },
  { g: 'linear-gradient(135deg, #164e63, #0e7490, #0891b2)', s: '#0e7490' },
  { g: 'linear-gradient(135deg, #7c2d12, #b91c1c, #be185d)', s: '#b91c1c' },
  { g: 'linear-gradient(135deg, #0e7490, #6d28d9, #be185d)', s: '#6d28d9' },
  { g: 'linear-gradient(135deg, #14532d, #0f766e, #0c4a6e)', s: '#0f766e' },
  { g: 'linear-gradient(135deg, #374151, #4b5563, #6b7280)', s: '#4b5563' },
];


const CARD_W = 312; // 300 minWidth + 12 gap

function InfiniteCarousel({
  items,
  onNavigate,
  onHideCard,
}: {
  items: CardResponse[];
  onNavigate: (id: string) => void;
  onHideCard: (id: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const offset = useRef(0);
  const startX = useRef(0);
  const lastX = useRef(0);
  const velocity = useRef(0);
  const lastTime = useRef(0);
  const dragging = useRef(false);
  const moved = useRef(false);
  const raf = useRef<number>();

  const n = items.length;
  const tripled = useMemo(() => [...items, ...items, ...items], [items]);
  const baseOffset = -(n * CARD_W);

  useEffect(() => {
    offset.current = baseOffset;
    if (trackRef.current) {
      trackRef.current.style.transform = `translateX(${baseOffset}px)`;
    }
  }, [baseOffset]);

  const applyOffset = (val: number) => {
    const span = n * CARD_W;
    let v = val;
    if (v > -(span * 0.5)) v -= span;
    if (v < -(span * 2.5)) v += span;
    offset.current = v;
    if (trackRef.current) {
      trackRef.current.style.transform = `translateX(${v}px)`;
    }
  };

  const startDrag = (x: number) => {
    dragging.current = true;
    moved.current = false;
    startX.current = x;
    lastX.current = x;
    lastTime.current = Date.now();
    velocity.current = 0;
    if (raf.current) cancelAnimationFrame(raf.current);
  };

  const moveDrag = (x: number) => {
    if (!dragging.current) return;
    const dx = x - lastX.current;
    const dt = Date.now() - lastTime.current;
    if (Math.abs(x - startX.current) > 5) moved.current = true;
    velocity.current = dt > 0 ? dx / dt : 0;
    lastX.current = x;
    lastTime.current = Date.now();
    applyOffset(offset.current + dx);
  };

  const endDrag = () => {
    if (!dragging.current) return;
    dragging.current = false;
    let vel = velocity.current * 18;
    const tick = () => {
      if (Math.abs(vel) < 0.3) return;
      vel *= 0.94;
      applyOffset(offset.current + vel);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  };

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => moveDrag(e.clientX);
    const onMouseUp = () => endDrag();
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, []);

  // Trackpad two-finger horizontal scroll
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const dx = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : 0;
      if (!dx) return;
      e.preventDefault();
      if (raf.current) cancelAnimationFrame(raf.current);
      applyOffset(offset.current - dx);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [n]);

  return (
    <div ref={containerRef} style={{ overflow: 'hidden', margin: '0 -20px', padding: '14px 0' }}>
      <div
        ref={trackRef}
        onTouchStart={(e) => startDrag(e.touches[0].clientX)}
        onTouchMove={(e) => moveDrag(e.touches[0].clientX)}
        onTouchEnd={endDrag}
        onMouseDown={(e) => startDrag(e.clientX)}
        style={{
          display: 'flex',
          gap: 12,
          paddingLeft: 20,
          willChange: 'transform',
          userSelect: 'none',
          WebkitUserSelect: 'none' as any,
          cursor: 'grab',
        }}
      >
        {tripled.map((card, i) => (
          <div key={`${card.id}-${i}`} style={{ minWidth: 300, flexShrink: 0 }}>
            <VirtualCard
              name={card.name}
              last4={card.last4}
              balance={card.balance}
              currencySymbol={card.currency_symbol}
              currencyCode={card.currency_code}
              status={card.status}
              noShadow
              onHide={card.status === 'C' ? () => onHideCard(card.id) : undefined}
              onClick={() => { if (!moved.current) onNavigate(card.id); }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { client } = useAuth();
  const { data, loading, error } = useBalance();
  const { cards } = useCards();
  const navigate = useNavigate();
  const { t } = useLang();
  const { isDark } = useTheme();
  const [recentOps, setRecentOps] = useState<OperationResponse[]>([]);
  const [balanceHidden, setBalanceHidden] = useState(false);
  const [hiddenCardIds, setHiddenCardIds] = useState<string[]>([]);
  const [heroColor, setHeroColor] = useState(() => {
    const key = isDark ? 'heroColorDark' : 'heroColorLight';
    return localStorage.getItem(key) || (isDark ? HERO_COLORS_DARK[0].g : HERO_COLORS_LIGHT[0].g);
  });
  const [showColorPicker, setShowColorPicker] = useState(false);

  const HERO_COLORS = isDark ? HERO_COLORS_DARK : HERO_COLORS_LIGHT;
  const heroShadow = HERO_COLORS.find((c) => c.g === heroColor)?.s || (isDark ? '#302b63' : '#1d4ed8');

  useEffect(() => {
    const key = isDark ? 'heroColorDark' : 'heroColorLight';
    const def = isDark ? HERO_COLORS_DARK[0].g : HERO_COLORS_LIGHT[0].g;
    setHeroColor(localStorage.getItem(key) || def);
  }, [isDark]);

  const pickHeroColor = (g: string) => {
    setHeroColor(g);
    localStorage.setItem(isDark ? 'heroColorDark' : 'heroColorLight', g);
    setShowColorPicker(false);
  };

  useEffect(() => {
    fetchOperations(0, 3).then((res) => setRecentOps(res.items)).catch(() => {});
  }, []);

  const visibleCards = cards.filter((c) => !hiddenCardIds.includes(c.id));

  // Aggregate card balances by currency
  const sumCards = (code: string) =>
    cards
      .filter((c) => c.currency_code === code)
      .reduce((sum, c) => sum + parseFloat(c.balance || '0'), 0);

  const usdtAccount = data?.accounts.find((a) =>
    a.currency_code === 'USDT' || a.currency_symbol?.includes('USDT')
  );
  const usdTotal = sumCards('USD');
  const eurTotal = sumCards('EUR');

  const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="page">
      {loading && <Spinner />}
      {error && <p className="error-text">{error}</p>}

      {data && (
        <>
          {/* Balance Hero */}
          <div
            style={{
              background: heroColor,
              borderRadius: 'var(--radius-xl)',
              padding: '20px 24px',
              margin: '8px 0 24px',
              position: 'relative',
              overflow: 'hidden',
              boxShadow: `0 8px 32px ${heroShadow}88`,
              transition: 'background 0.4s ease, box-shadow 0.4s ease',
            }}
          >
            {/* Decorative orbs */}
            <div style={{
              position: 'absolute', top: '-60%', right: '-30%', width: 200, height: 200,
              background: 'radial-gradient(circle, rgba(255,255,255,0.08), transparent 70%)',
              borderRadius: '50%', animation: 'orbFloat 8s ease-in-out infinite', pointerEvents: 'none',
            }} />
            <div style={{
              position: 'absolute', bottom: '-40%', left: '-20%', width: 160, height: 160,
              background: 'radial-gradient(circle, rgba(255,255,255,0.05), transparent 70%)',
              borderRadius: '50%', animation: 'orbFloat 12s ease-in-out infinite reverse', pointerEvents: 'none',
            }} />

            {/* Header row */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 16, position: 'relative', zIndex: 1,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>
                  <span style={{ color: '#10B981' }}>Virt</span>
                  <span style={{ color: '#93C5FD' }}>Card</span>
                  <span style={{ color: '#FCD34D' }}>Pay</span>
                </span>
                {client && (
                  <span style={{
                    fontSize: 11, color: 'rgba(255,255,255,0.55)', fontWeight: 500,
                    background: 'rgba(255,255,255,0.08)', borderRadius: 6,
                    padding: '2px 8px', border: '1px solid rgba(255,255,255,0.12)',
                  }}>
                    @{client.telegram_username || client.name}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 6, position: 'relative', zIndex: 2 }}>
                {/* Color picker button */}
                <button
                  onClick={() => setShowColorPicker((v) => !v)}
                  title="Сменить цвет"
                  style={{
                    background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.18)',
                    borderRadius: 8, width: 28, height: 28, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="13.5" cy="6.5" r=".5" fill="rgba(255,255,255,0.8)"/>
                    <circle cx="17.5" cy="10.5" r=".5" fill="rgba(255,255,255,0.8)"/>
                    <circle cx="8.5" cy="7.5" r=".5" fill="rgba(255,255,255,0.8)"/>
                    <circle cx="6.5" cy="12.5" r=".5" fill="rgba(255,255,255,0.8)"/>
                    <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>
                  </svg>
                </button>
                {/* Eye button */}
                <button
                  onClick={() => setBalanceHidden((h) => !h)}
                  style={{
                    background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.18)',
                    borderRadius: 8, width: 28, height: 28, cursor: 'pointer',
                    color: balanceHidden ? '#93C5FD' : 'rgba(255,255,255,0.7)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <EyeIcon size={14} />
                </button>
              </div>
            </div>

            {/* Color picker palette */}
            {showColorPicker && (
              <div style={{
                display: 'flex', gap: 8, flexWrap: 'wrap',
                marginBottom: 14, position: 'relative', zIndex: 2,
                background: 'rgba(0,0,0,0.25)', borderRadius: 12,
                padding: '10px 12px',
              }}>
                {HERO_COLORS.map((c) => (
                  <button
                    key={c.g}
                    onClick={() => pickHeroColor(c.g)}
                    style={{
                      width: 26, height: 26, borderRadius: '50%', background: c.g,
                      border: heroColor === c.g ? '2px solid #fff' : '2px solid rgba(255,255,255,0.2)',
                      cursor: 'pointer', flexShrink: 0,
                      boxShadow: heroColor === c.g ? `0 0 8px ${c.s}` : 'none',
                      transition: 'border 0.15s, box-shadow 0.15s',
                    }}
                  />
                ))}
              </div>
            )}

            {/* Title */}
            <div style={{
              fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: 1.2,
              marginBottom: 12, position: 'relative', zIndex: 1,
            }}>
              {t('total_balance')}
            </div>

            {/* Balance rows */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, position: 'relative', zIndex: 1 }}>
              {[
                { code: 'USDT', color: 'rgba(255,255,255,0.95)', bg: 'rgba(255,255,255,0.15)', symbol: '₮', value: fmt(parseFloat(usdtAccount?.balance || '0')) },
                { code: 'USD',  color: 'rgba(255,255,255,0.95)', bg: 'rgba(255,255,255,0.12)', symbol: '$', value: fmt(usdTotal) },
                { code: 'EUR',  color: 'rgba(255,255,255,0.95)', bg: 'rgba(255,255,255,0.10)', symbol: '€', value: fmt(eurTotal) },
              ].map((row, i, arr) => (
                <div key={row.code}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{
                        width: 18, height: 18, borderRadius: '50%', background: row.bg,
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 10, fontWeight: 800, color: row.color, flexShrink: 0,
                      }}>{row.symbol}</span>
                      <span style={{
                        fontSize: 10, fontWeight: 700, background: row.bg,
                        color: row.color, borderRadius: 5, padding: '2px 6px', letterSpacing: 0.3,
                      }}>{row.code}</span>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: -0.2, color: '#fff' }}>
                      {balanceHidden ? '••••••' : row.value}
                    </span>
                  </div>
                  {i < arr.length - 1 && (
                    <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', marginTop: 10 }} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 28 }}>
            {[
              { label: t('action_deposit'), Icon: ArrowDownIcon, opacity: 0.22, path: '/deposit' },
              { label: t('action_withdraw'), Icon: ArrowUpIcon, opacity: 0.17, path: '/withdraw' },
              { label: t('action_new_card'), Icon: PlusIcon, opacity: 0.13, path: '/cards/issue' },
              { label: t('action_my_cards'), Icon: CreditCardIcon, opacity: 0.19, path: '/cards' },
              { label: t('action_history'), Icon: ClockIcon, opacity: 0.15, path: '/history' },
            ].map((action) => (
              <div
                key={action.label}
                onClick={() => navigate(action.path)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                  cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
                }}
              >
                <div style={{
                  width: 46, height: 46, borderRadius: 14,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: isDark
                    ? 'rgba(255,255,255,0.04)'
                    : `linear-gradient(135deg, ${heroShadow}${Math.round(action.opacity * 255).toString(16).padStart(2, '0')}, ${heroShadow}${Math.round(action.opacity * 0.4 * 255).toString(16).padStart(2, '0')})`,
                  color: isDark ? 'rgba(255,255,255,0.9)' : heroShadow,
                  border: isDark ? '1.5px solid rgba(255,255,255,0.22)' : 'none',
                  boxShadow: isDark ? '0 0 0 0 transparent' : `0 0 14px ${heroShadow}55`,
                  transition: 'background 0.4s ease, color 0.4s ease, box-shadow 0.4s ease',
                }}>
                  <action.Icon size={20} />
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500, textAlign: 'center', lineHeight: 1.3 }}>
                  {action.label}
                </div>
              </div>
            ))}
          </div>

          {/* Cards Carousel */}
          {visibleCards.length > 0 && (
            <>
              <div className="section-header">
                <div className="section-title">{t('active_cards')}</div>
              </div>
              <div style={{ marginBottom: 28 }}>
                <InfiniteCarousel
                  items={visibleCards}
                  onNavigate={(id) => navigate(`/cards/${id}`)}
                  onHideCard={(id) => setHiddenCardIds((prev) => [...prev, id])}
                />
              </div>
            </>
          )}

          {/* Recent Activity */}
          {recentOps.length > 0 && (
            <>
              <div className="section-header">
                <div className="section-title">{t('recent_ops')}</div>
                <div className="section-link" onClick={() => navigate('/history')}>{t('all')}</div>
              </div>
              <div className="glass-card" style={{ padding: '4px 16px' }}>
                {recentOps.map((op) => (
                  <OperationListItem key={op.id} operation={op} borderless />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
