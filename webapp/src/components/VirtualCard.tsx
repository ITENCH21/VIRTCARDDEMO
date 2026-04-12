import { useState } from 'react';
import { useLang } from '../contexts/LangContext';
import { fetchCardSensitive, CardSensitiveResponse } from '../api/cards';
import { CopyIcon, CheckIcon } from './icons';

interface Props {
  name?: string;
  last4: string;
  balance: string;
  currencySymbol: string;
  currencyCode?: string;
  variant?: number;
  noShadow?: boolean;
  status?: string;
  onHide?: () => void;
  onClick?: () => void;
  cardId?: string;
  flippable?: boolean;
}

function getCardTheme(currencyCode?: string) {
  const code = (currencyCode || '').toUpperCase();
  if (code === 'USD')
    return {
      gradient: 'linear-gradient(135deg, #1e40af, #2563eb, #3b82f6, #60a5fa)',
      glow: 'rgba(59,130,246,0.45)',
      badge: 'rgba(255,255,255,0.18)',
    };
  if (code === 'EUR')
    return {
      gradient: 'linear-gradient(135deg, #92400e, #d97706, #f59e0b, #fbbf24)',
      glow: 'rgba(245,158,11,0.45)',
      badge: 'rgba(255,255,255,0.18)',
    };
  return {
    gradient: 'linear-gradient(135deg, #4c1d95, #6d28d9, #7c3aed, #8b5cf6)',
    glow: 'rgba(139,92,246,0.45)',
    badge: 'rgba(255,255,255,0.18)',
  };
}

function getCornerRibbon(status?: string): { bg: string; color: string } | null {
  if (status === 'C') return { bg: '#ef4444', color: '#fff' };
  return null;
}

function formatCardNumber(num: string) {
  return num.replace(/(.{4})/g, '$1 ').trim();
}

export default function VirtualCard({ name, last4, balance, currencySymbol, currencyCode, variant = 0, onClick, noShadow, status, onHide, cardId, flippable }: Props) {
  const { t } = useLang();
  const isClosed = status === 'C';
  const theme = getCardTheme(currencyCode);
  const ribbon = getCornerRibbon(status);

  const [isFlipped, setIsFlipped] = useState(false);
  const [sensitive, setSensitive] = useState<CardSensitiveResponse | null>(null);
  const [loadingSensitive, setLoadingSensitive] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const handleFlip = async () => {
    if (!flippable || !cardId) {
      onClick?.();
      return;
    }

    if (!isFlipped && !sensitive) {
      setLoadingSensitive(true);
      try {
        const data = await fetchCardSensitive(cardId);
        setSensitive(data);
        setIsFlipped(true);
      } catch {
        // silently fail
      } finally {
        setLoadingSensitive(false);
      }
    } else {
      setIsFlipped(!isFlipped);
    }
  };

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 1500);
  };

  const cardFaceStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    borderRadius: 'var(--radius-xl)',
    backfaceVisibility: 'hidden',
    WebkitBackfaceVisibility: 'hidden',
  };

  // Front side content
  const frontSide = (
    <div onClick={handleFlip} style={{
      ...cardFaceStyle,
      padding: 24,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      overflow: 'hidden',
      background: theme.gradient,
    }}>
      {/* Decorative orbs */}
      <div style={{
        position: 'absolute', top: '-30%', right: '-20%', width: 200, height: 200,
        background: 'radial-gradient(circle, rgba(255,255,255,0.12), transparent 70%)', borderRadius: '50%',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: '-20%', left: '-10%', width: 150, height: 150,
        background: 'radial-gradient(circle, rgba(255,255,255,0.06), transparent 70%)', borderRadius: '50%',
        pointerEvents: 'none',
      }} />

      {/* Top: Brand + badge */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 1 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: 0.5, lineHeight: 1 }}>
            <span style={{ color: '#10b981' }}>Virt</span>
            <span style={{ color: '#fff' }}>Card</span>
            <span style={{ color: '#f59e0b' }}>Pay</span>
          </div>
          <div style={{ height: 8 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'nowrap' }}>
            <style>{`
              @keyframes chipSheen {
                0%    { transform: translateX(-150%) skewX(-15deg); opacity: 1; }
                20%   { transform: translateX(250%) skewX(-15deg); opacity: 1; }
                20.1%, 100% { transform: translateX(-150%) skewX(-15deg); opacity: 0; }
              }
            `}</style>
            <div style={{
              width: 36, height: 28, flexShrink: 0,
              background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
              borderRadius: 6, opacity: 0.9,
              position: 'relative', overflow: 'hidden',
            }}>
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                background: 'linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.8) 50%, transparent 70%)',
                animation: 'chipSheen 5s ease-in-out infinite',
                pointerEvents: 'none',
              }} />
            </div>
            {isClosed && (
              <>
                <div style={{
                  background: '#ef4444', borderRadius: 10,
                  padding: '2px 7px', fontSize: 9, fontWeight: 700,
                  color: '#fff', letterSpacing: 0.3, whiteSpace: 'nowrap',
                }}>
                  {t('card_status_closed')}
                </div>
                {onHide && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onHide(); }}
                    style={{
                      background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.25)',
                      borderRadius: 10, padding: '2px 7px', color: 'rgba(255,255,255,0.8)',
                      fontSize: 9, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                    }}
                  >
                    {t('card_hide')}
                  </button>
                )}
              </>
            )}
            {(status === 'A' || status === 'R') && (
              <div style={{
                background: '#10b981', borderRadius: 10,
                padding: '2px 7px', fontSize: 9, fontWeight: 700,
                color: '#fff', letterSpacing: 0.3, whiteSpace: 'nowrap',
              }}>
                {t('card_status_active')}
              </div>
            )}
            {status === 'L' && (
              <div style={{
                background: '#e0f2fe', borderRadius: 10,
                padding: '2px 7px', fontSize: 9, fontWeight: 700,
                color: '#0284c7', letterSpacing: 0.3, whiteSpace: 'nowrap',
              }}>
                {t('card_status_frozen')}
              </div>
            )}
          </div>
        </div>
        <div style={{
          fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.85)',
          background: theme.badge, padding: '3px 10px', borderRadius: 20,
          textTransform: 'uppercase', letterSpacing: 0.5,
          backdropFilter: 'blur(4px)',
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
        {isClosed && (
          <div style={{
            position: 'absolute', top: '50%', left: 0, right: 0,
            height: 1.5, background: '#ef4444',
            transform: 'translateY(-50%)',
            borderRadius: 1,
            pointerEvents: 'none',
          }} />
        )}
      </div>

      {/* Corner ribbon */}
      {ribbon && (
        <div style={{
          position: 'absolute', bottom: 18, right: -28,
          width: 110, height: 20,
          background: ribbon.bg,
          transform: 'rotate(-45deg)',
          pointerEvents: 'none',
          zIndex: 2,
          boxShadow: '0 2px 6px rgba(239,68,68,0.5)',
        }} />
      )}

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

      {/* Loading overlay */}
      {loadingSensitive && (
        <div style={{
          position: 'absolute', inset: 0, borderRadius: 'var(--radius-xl)',
          background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 10,
        }}>
          <div style={{ width: 28, height: 28, border: '3px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <style>{`
            @keyframes spin { to { transform: rotate(360deg); } }
            .card-copy-btn:active {
              transform: scale(0.93);
              background: rgba(255,255,255,0.25) !important;
            }
          `}</style>
        </div>
      )}
    </div>
  );

  // Back side content
  const backSide = (
    <div onClick={handleFlip} style={{
      ...cardFaceStyle,
      transform: 'rotateY(180deg)',
      padding: 24,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      overflow: 'hidden',
      background: theme.gradient,
    }}>
      {/* Decorative orbs */}
      <div style={{
        position: 'absolute', top: '-20%', left: '-15%', width: 180, height: 180,
        background: 'radial-gradient(circle, rgba(255,255,255,0.1), transparent 70%)', borderRadius: '50%',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: '-25%', right: '-10%', width: 160, height: 160,
        background: 'radial-gradient(circle, rgba(255,255,255,0.08), transparent 70%)', borderRadius: '50%',
        pointerEvents: 'none',
      }} />

      {/* Magnetic stripe */}
      <div style={{
        position: 'absolute', top: 20, left: 0, right: 0, height: 40,
        background: 'rgba(0,0,0,0.35)',
        pointerEvents: 'none',
      }} />

      {/* Card details */}
      <div style={{ marginTop: 56, position: 'relative', zIndex: 1 }}>
        {/* Card number */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', letterSpacing: 1, marginBottom: 4 }}>
            {t('card_number_label')}
          </div>
          <div style={{
            fontSize: 17, fontWeight: 600, color: '#fff',
            letterSpacing: 2.5, fontFamily: "'SF Mono','Menlo',monospace",
          }}>
            {sensitive ? formatCardNumber(sensitive.card_number) : ''}
          </div>
        </div>

        {/* Expiry + CVV row */}
        <div style={{ display: 'flex', gap: 32 }}>
          <div>
            <div style={{ fontSize: 10, textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', letterSpacing: 1, marginBottom: 4 }}>
              {t('expiry_label')}
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#fff', fontFamily: "'SF Mono','Menlo',monospace" }}>
              {sensitive ? `${sensitive.expiry_month}/${sensitive.expiry_year.slice(-2)}` : ''}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', letterSpacing: 1, marginBottom: 4 }}>
              CVV
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#fff', fontFamily: "'SF Mono','Menlo',monospace" }}>
              {sensitive?.cvv || ''}
            </div>
          </div>
        </div>
      </div>

      {/* Copy button — stops propagation, doesn't flip */}
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'center' }}>
        {sensitive && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              handleCopy(sensitive.card_number, 'number');
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            className="card-copy-btn"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '8px 20px', borderRadius: 10,
              background: 'rgba(255,255,255,0.15)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.2)',
              color: '#fff', fontSize: 12, fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {copied === 'number'
              ? <><CheckIcon size={14} style={{ color: '#10b981' }} /> {t('copied') || 'Copied!'}</>
              : <><CopyIcon size={14} /> {t('copy_number') || 'Copy number'}</>
            }
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div
      style={{
        width: '100%',
        aspectRatio: '1.6 / 1',
        perspective: 1000,
        cursor: 'pointer',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          transformStyle: 'preserve-3d',
          transition: 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
          transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: noShadow ? 'none' : `0 8px 32px ${theme.glow}`,
        }}
      >
        {frontSide}
        {backSide}
      </div>
    </div>
  );
}
