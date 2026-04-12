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
import StatusBadge from '../components/StatusBadge';
import { ArrowDownIcon, ArrowUpIcon, PlusIcon, CreditCardIcon, EyeIcon, ClockIcon } from '../components/icons';
import { formatAmount, formatDate } from '../lib/format';
import { useLang } from '../contexts/LangContext';
import { useTheme } from '../contexts/ThemeContext';
import { useLayout } from '../contexts/LayoutContext';

const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* ═══════════════════════════════════════════
   MOBILE: Hero colors for balance block
   ═══════════════════════════════════════════ */
type HeroColor = { g: string; s: string };
const HERO_COLORS_DARK: HeroColor[] = [
  { g: 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)', s: '#302b63' },
  { g: 'linear-gradient(135deg, #141e30, #243b55, #0a1628)', s: '#243b55' },
  { g: 'linear-gradient(135deg, #0f2027, #203a43, #2c5364)', s: '#203a43' },
  { g: 'linear-gradient(135deg, #001845, #001f54, #00356b)', s: '#001f54' },
  { g: 'linear-gradient(135deg, #1a0533, #3d0e6d, #5c1a9a)', s: '#3d0e6d' },
  { g: 'linear-gradient(135deg, #0f172a, #1e293b, #334155)', s: '#334155' },
];
const HERO_COLORS_LIGHT: HeroColor[] = [
  { g: 'linear-gradient(135deg, #1e3a8a, #1d4ed8, #3b82f6)', s: '#1d4ed8' },
  { g: 'linear-gradient(135deg, #0c4a6e, #0369a1, #0ea5e9)', s: '#0369a1' },
  { g: 'linear-gradient(135deg, #1e1b4b, #3730a3, #4f46e5)', s: '#3730a3' },
  { g: 'linear-gradient(135deg, #4c1d95, #6d28d9, #7c3aed)', s: '#6d28d9' },
  { g: 'linear-gradient(135deg, #14532d, #15803d, #16a34a)', s: '#15803d' },
  { g: 'linear-gradient(135deg, #374151, #4b5563, #6b7280)', s: '#4b5563' },
];

/* ═══════════════════════════════════════════
   MOBILE: Infinite carousel for cards
   ═══════════════════════════════════════════ */
const CARD_W = 312;

function InfiniteCarousel({ items, onNavigate, onHideCard }: {
  items: CardResponse[]; onNavigate: (id: string) => void; onHideCard: (id: string) => void;
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
    if (trackRef.current) trackRef.current.style.transform = `translateX(${baseOffset}px)`;
  }, [baseOffset]);

  const applyOffset = (val: number) => {
    const span = n * CARD_W;
    let v = val;
    if (v > -(span * 0.5)) v -= span;
    if (v < -(span * 2.5)) v += span;
    offset.current = v;
    if (trackRef.current) trackRef.current.style.transform = `translateX(${v}px)`;
  };

  const startDrag = (x: number) => {
    dragging.current = true; moved.current = false;
    startX.current = x; lastX.current = x;
    lastTime.current = Date.now(); velocity.current = 0;
    if (raf.current) cancelAnimationFrame(raf.current);
  };
  const moveDrag = (x: number) => {
    if (!dragging.current) return;
    const dx = x - lastX.current;
    const dt = Date.now() - lastTime.current;
    if (Math.abs(x - startX.current) > 5) moved.current = true;
    velocity.current = dt > 0 ? dx / dt : 0;
    lastX.current = x; lastTime.current = Date.now();
    applyOffset(offset.current + dx);
  };
  const endDrag = () => {
    if (!dragging.current) return;
    dragging.current = false;
    let vel = velocity.current * 18;
    const tick = () => {
      if (Math.abs(vel) < 0.3) return;
      vel *= 0.94; applyOffset(offset.current + vel);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  };

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => moveDrag(e.clientX);
    const onMouseUp = () => endDrag();
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => { window.removeEventListener('mousemove', onMouseMove); window.removeEventListener('mouseup', onMouseUp); if (raf.current) cancelAnimationFrame(raf.current); };
  }, []);

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
      <div ref={trackRef}
        onTouchStart={(e) => startDrag(e.touches[0].clientX)}
        onTouchMove={(e) => moveDrag(e.touches[0].clientX)}
        onTouchEnd={endDrag}
        onMouseDown={(e) => startDrag(e.clientX)}
        style={{ display: 'flex', gap: 12, paddingLeft: 20, willChange: 'transform', userSelect: 'none', cursor: 'grab' }}
      >
        {tripled.map((card, i) => (
          <div key={`${card.id}-${i}`} style={{ minWidth: 300, flexShrink: 0 }}>
            <VirtualCard name={card.name} last4={card.last4} balance={card.balance}
              currencySymbol={card.currency_symbol} currencyCode={card.currency_code}
              status={card.status} noShadow cardId={card.id} flippable
              onHide={card.status === 'C' ? () => onHideCard(card.id) : undefined}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   SHARED: Main component
   ═══════════════════════════════════════════ */
export default function DashboardPage() {
  const { client } = useAuth();
  const { data, loading, error } = useBalance();
  const { cards } = useCards();
  const navigate = useNavigate();
  const { t } = useLang();
  const { isDark } = useTheme();
  const { isDesktop } = useLayout();
  const [recentOps, setRecentOps] = useState<OperationResponse[]>([]);
  const [balanceHidden, setBalanceHidden] = useState(false);
  const [hiddenCardIds, setHiddenCardIds] = useState<string[]>([]);

  // Mobile hero color
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
    fetchOperations(0, isDesktop ? 5 : 3).then((res) => setRecentOps(res.items)).catch(() => {});
  }, [isDesktop]);

  // Shared calculations
  const sumCards = (code: string) =>
    cards.filter((c) => c.currency_code === code).reduce((sum, c) => sum + parseFloat(c.balance || '0'), 0);
  const usdtAccount = data?.accounts.find((a) => a.currency_code === 'USDT' || a.currency_symbol?.includes('USDT'));
  const usdTotal = sumCards('USD');
  const eurTotal = sumCards('EUR');
  const activeCards = cards.filter((c) => c.status === 'A' || c.status === 'R');
  const visibleCards = cards.filter((c) => !hiddenCardIds.includes(c.id));

  const ACTIONS = [
    { label: t('action_deposit'), Icon: ArrowDownIcon, path: '/deposit', color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
    { label: t('action_withdraw'), Icon: ArrowUpIcon, path: '/withdraw', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
    { label: t('action_new_card'), Icon: PlusIcon, path: '/cards/issue', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
    { label: t('action_my_cards'), Icon: CreditCardIcon, path: '/cards', color: '#06b6d4', bg: 'rgba(6,182,212,0.12)' },
    { label: t('action_history'), Icon: ClockIcon, path: '/history', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  ];

  /* ═══════════════════════════════════════════
     DESKTOP RENDER
     ═══════════════════════════════════════════ */
  if (isDesktop) {
    return (
      <div className="page">
        {loading && <Spinner />}
        {error && <p className="error-text">{error}</p>}
        {data && (
          <>
            {/* Balance Widgets */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 28 }}>
              <div className="stat-widget">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div className="stat-widget-label">{t('usdt_balance')}</div>
                  <button onClick={() => setBalanceHidden((h) => !h)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: balanceHidden ? 'var(--accent-1)' : 'var(--text-muted)', padding: 4 }}>
                    <EyeIcon size={16} />
                  </button>
                </div>
                <div className="stat-widget-value" style={{ color: 'var(--accent-1)' }}>
                  {balanceHidden ? '••••••' : `₮${fmt(parseFloat(usdtAccount?.balance || '0'))}`}
                </div>
                <div className="stat-widget-sub">{t('main_account')}</div>
              </div>
              <div className="stat-widget">
                <div className="stat-widget-label">USD {t('cards_label')}</div>
                <div className="stat-widget-value">{balanceHidden ? '••••••' : `$${fmt(usdTotal)}`}</div>
                <div className="stat-widget-sub">{cards.filter(c => c.currency_code === 'USD').length} {t('nav_cards').toLowerCase()}</div>
              </div>
              <div className="stat-widget">
                <div className="stat-widget-label">EUR {t('cards_label')}</div>
                <div className="stat-widget-value">{balanceHidden ? '••••••' : `€${fmt(eurTotal)}`}</div>
                <div className="stat-widget-sub">{cards.filter(c => c.currency_code === 'EUR').length} {t('nav_cards').toLowerCase()}</div>
              </div>
              <div className="stat-widget">
                <div className="stat-widget-label">{t('active_cards')}</div>
                <div className="stat-widget-value">{activeCards.length}</div>
                <div className="stat-widget-sub">{cards.length} {t('total').toLowerCase()}</div>
              </div>
            </div>

            {/* Quick Actions — horizontal buttons */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 28, flexWrap: 'wrap' }}>
              {ACTIONS.map((a) => (
                <button key={a.path} onClick={() => navigate(a.path)} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '12px 20px',
                  borderRadius: 'var(--radius-md)', background: 'var(--bg-card)',
                  border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)',
                  cursor: 'pointer', transition: 'var(--transition-normal)',
                  color: 'var(--text-primary)', fontSize: 14, fontWeight: 600,
                }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: a.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: a.color }}>
                    <a.Icon size={18} />
                  </div>
                  {a.label}
                </button>
              ))}
            </div>

            {/* Cards Grid */}
            {activeCards.length > 0 && (
              <>
                <div className="section-header" style={{ marginBottom: 16 }}>
                  <div className="section-title">{t('active_cards')}</div>
                  <div className="section-link" onClick={() => navigate('/cards')}>{t('all')} ({cards.length})</div>
                </div>
                <div className="cards-grid" style={{ marginBottom: 32 }}>
                  {activeCards.slice(0, 4).map((card) => (
                    <VirtualCard key={card.id} name={card.name} last4={card.last4}
                      balance={formatAmount(card.balance, card.currency_symbol)} currencySymbol=""
                      currencyCode={card.currency_code} status={card.status}
                      cardId={card.id} flippable />
                  ))}
                </div>
              </>
            )}

            {/* Operations Table */}
            {recentOps.length > 0 && (
              <>
                <div className="section-header" style={{ marginBottom: 16 }}>
                  <div className="section-title">{t('recent_ops')}</div>
                  <div className="section-link" onClick={() => navigate('/history')}>{t('all')}</div>
                </div>
                <table className="desktop-table">
                  <thead><tr>
                    <th>{t('filter_type')}</th><th>{t('amount_label')}</th>
                    <th>{t('filter_status')}</th><th style={{ textAlign: 'right' }}>{t('date_col')}</th>
                  </tr></thead>
                  <tbody>
                    {recentOps.map((op) => {
                      const kindKey = `kind_${op.kind}` as Parameters<typeof t>[0];
                      const kindLabel = kindKey in { kind_DE: 1, kind_WI: 1, kind_CO: 1, kind_CT: 1, kind_CB: 1, kind_CR: 1, kind_CC: 1 } ? t(kindKey) : op.kind_label;
                      const statusKey = `status_${op.status}` as Parameters<typeof t>[0];
                      const isPositive = op.kind.toLowerCase().includes('de');
                      return (
                        <tr key={op.id}>
                          <td style={{ fontWeight: 500 }}>{kindLabel}</td>
                          <td style={{ fontWeight: 600, color: isPositive ? 'var(--success)' : 'var(--text-primary)' }}>
                            {isPositive ? '+' : ''}{formatAmount(op.amount, op.currency_symbol)}
                          </td>
                          <td><StatusBadge status={op.status} label={t(statusKey)} /></td>
                          <td style={{ textAlign: 'right', color: 'var(--text-muted)', fontSize: 13 }}>{formatDate(op.created_at)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </>
            )}
          </>
        )}
      </div>
    );
  }

  /* ═══════════════════════════════════════════
     MOBILE RENDER (TG Mini App)
     ═══════════════════════════════════════════ */
  return (
    <div className="page">
      {loading && <Spinner />}
      {error && <p className="error-text">{error}</p>}
      {data && (
        <>
          {/* Hero Balance */}
          <div style={{
            background: heroColor, borderRadius: 'var(--radius-xl)',
            padding: '20px 24px', margin: '8px 0 24px', position: 'relative', overflow: 'hidden',
            boxShadow: `0 8px 32px ${heroShadow}88`, transition: 'background 0.4s ease, box-shadow 0.4s ease',
          }}>
            <div style={{ position: 'absolute', top: '-60%', right: '-30%', width: 200, height: 200, background: 'radial-gradient(circle, rgba(255,255,255,0.08), transparent 70%)', borderRadius: '50%', animation: 'orbFloat 8s ease-in-out infinite', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: '-40%', left: '-20%', width: 160, height: 160, background: 'radial-gradient(circle, rgba(255,255,255,0.05), transparent 70%)', borderRadius: '50%', animation: 'orbFloat 12s ease-in-out infinite reverse', pointerEvents: 'none' }} />

            {/* Header row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, position: 'relative', zIndex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>
                  <span style={{ color: '#10B981' }}>Virt</span><span style={{ color: '#93C5FD' }}>Card</span><span style={{ color: '#FCD34D' }}>Pay</span>
                </span>
                {client && (() => {
                  const username = '@' + (client.telegram_username || client.name);
                  const isLong = username.length > 12;
                  const overflowPx = Math.max(0, username.length * 6.5 - 74);
                  return (
                    <span className={`username-marquee-badge${isLong ? ' scrolling' : ''}`}
                      style={{ fontSize: 11, color: 'rgba(255,255,255,0.9)', fontWeight: 600, background: 'rgba(255,255,255,0.08)', borderRadius: 6, padding: '2px 8px', border: '1px solid rgba(255,255,255,0.25)', ['--marquee-dist' as string]: `-${overflowPx}px` }}>
                      <span className="username-text">{username}</span>
                    </span>
                  );
                })()}
              </div>
              <div style={{ display: 'flex', gap: 6, position: 'relative', zIndex: 2 }}>
                <button onClick={() => setShowColorPicker((v) => !v)} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 8, width: 28, height: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="13.5" cy="6.5" r=".5" fill="rgba(255,255,255,0.8)"/><circle cx="17.5" cy="10.5" r=".5" fill="rgba(255,255,255,0.8)"/><circle cx="8.5" cy="7.5" r=".5" fill="rgba(255,255,255,0.8)"/><circle cx="6.5" cy="12.5" r=".5" fill="rgba(255,255,255,0.8)"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>
                </button>
                <button onClick={() => setBalanceHidden((h) => !h)} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 8, width: 28, height: 28, cursor: 'pointer', color: balanceHidden ? '#93C5FD' : 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <EyeIcon size={14} />
                </button>
              </div>
            </div>

            {/* Color picker */}
            {showColorPicker && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14, position: 'relative', zIndex: 2, background: 'rgba(0,0,0,0.25)', borderRadius: 12, padding: '10px 12px' }}>
                {HERO_COLORS.map((c) => (
                  <button key={c.g} onClick={() => pickHeroColor(c.g)} style={{
                    width: 26, height: 26, borderRadius: '50%', background: c.g,
                    border: heroColor === c.g ? '2px solid #fff' : '2px solid rgba(255,255,255,0.2)',
                    cursor: 'pointer', flexShrink: 0,
                    boxShadow: heroColor === c.g ? `0 0 8px ${c.s}` : 'none',
                  }} />
                ))}
              </div>
            )}

            {/* Balance title */}
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 12, position: 'relative', zIndex: 1 }}>
              {t('total_balance')}
            </div>

            {/* Balance rows */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, position: 'relative', zIndex: 1 }}>
              {[
                { code: 'USDT', symbol: '₮', value: fmt(parseFloat(usdtAccount?.balance || '0')), bg: 'rgba(255,255,255,0.15)' },
                { code: 'USD', symbol: '$', value: fmt(usdTotal), bg: 'rgba(255,255,255,0.12)' },
                { code: 'EUR', symbol: '€', value: fmt(eurTotal), bg: 'rgba(255,255,255,0.10)' },
              ].map((row, i, arr) => (
                <div key={row.code}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 18, height: 18, borderRadius: '50%', background: row.bg, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.95)', flexShrink: 0 }}>{row.symbol}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, background: row.bg, color: 'rgba(255,255,255,0.95)', borderRadius: 5, padding: '2px 6px', letterSpacing: 0.3 }}>{row.code}</span>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: -0.2, color: '#fff' }}>
                      {balanceHidden ? '••••••' : row.value}
                    </span>
                  </div>
                  {i < arr.length - 1 && <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', marginTop: 10 }} />}
                </div>
              ))}
            </div>
          </div>

          {/* Mobile Quick Actions — icon grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 28 }}>
            {ACTIONS.map((a) => (
              <div key={a.path} onClick={() => navigate(a.path)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}>
                <div style={{ width: 48, height: 48, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-card)', color: 'var(--accent-1)', boxShadow: 'var(--shadow-card)', transition: 'all 0.25s ease' }}>
                  <a.Icon size={20} />
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500, textAlign: 'center', lineHeight: 1.3 }}>{a.label}</div>
              </div>
            ))}
          </div>

          {/* Cards Carousel */}
          {visibleCards.length > 0 && (
            <>
              <div className="section-header"><div className="section-title">{t('active_cards')}</div></div>
              <div style={{ marginBottom: 28 }}>
                <InfiniteCarousel items={visibleCards}
                  onNavigate={(id) => navigate(`/cards/${id}`)}
                  onHideCard={(id) => setHiddenCardIds((prev) => [...prev, id])} />
              </div>
            </>
          )}

          {/* Recent Operations — list */}
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
