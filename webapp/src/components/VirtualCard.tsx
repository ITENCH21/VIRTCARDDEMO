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

function getPaymentNetwork(currencyCode?: string): 'visa' | 'mastercard' {
  return (currencyCode || '').toUpperCase() === 'USD' ? 'visa' : 'mastercard';
}

function VisaLogo({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.32} viewBox="0 0 750 240" fill="none">
      <path d="M278 26.5l-64.3 186.6h-52.7L196.7 76c1.8-7 7-13 13.3-15 13.8-5.3 28-9.8 42.6-12.8L278 26.5zm173.5 125.8c.2-49.2-68-52-67.5-74 .2-6.7 6.5-13.8 20.4-15.6 17-2.2 45.3 1.2 57.7 7.8l10.3-47.8C460 17.3 443 12.5 422.8 12.5c-51.8 0-88.2 27.4-88.5 66.7-.3 29 26 45.2 45.8 54.8 20.4 9.8 27.3 16.2 27.2 25-.2 13.5-16.3 19.4-31.4 19.7-26.4.4-41.7-7.1-53.9-12.8l-9.5 44.4c12.3 5.6 34.8 10.5 58.3 10.7 55 0 91-27.2 91.2-69zM612.2 213H660L617.7 26.5h-42.6c-9.6 0-17.6 5.6-21.2 14.2L480.6 213h55l10.9-30.2h67.2l6.4 30.2zm-58.5-71.7l27.6-76 15.9 76h-43.5zM308.6 26.5l-43.3 186.6h-50.2l43.4-186.6h50.1z" fill="#fff"/>
    </svg>
  );
}

function MastercardLogo({ size = 42 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.77} viewBox="0 0 131.39 101.04" fill="none">
      <circle cx="47.37" cy="50.52" r="47.37" fill="rgba(235,0,27,0.9)"/>
      <circle cx="84.02" cy="50.52" r="47.37" fill="rgba(255,159,0,0.85)"/>
      <path d="M65.7 16.3a47.2 47.2 0 0 0-18.33 34.22A47.2 47.2 0 0 0 65.7 84.74a47.2 47.2 0 0 0 18.32-34.22A47.2 47.2 0 0 0 65.7 16.3z" fill="rgba(255,95,0,0.9)"/>
    </svg>
  );
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
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          {getPaymentNetwork(currencyCode) === 'visa'
            ? <VisaLogo size={48} />
            : <MastercardLogo size={36} />
          }
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
    <div
      onClickCapture={(e) => {
        if ((e.target as HTMLElement).closest('[data-copy]')) return;
        handleFlip();
      }}
      style={{
        ...cardFaceStyle,
        transform: 'rotateY(180deg)',
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        overflow: 'hidden',
        background: theme.gradient,
        cursor: 'pointer',
      }}
    >
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

      {/* Card details + inline copy icons */}
      <div style={{ marginTop: 56, position: 'relative', zIndex: 1 }}>
        {/* Card number + copy */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 10, textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', letterSpacing: 1, marginBottom: 4 }}>
              {t('card_number_label')}
            </div>
            <div style={{
              fontSize: 16, fontWeight: 600, color: '#fff',
              letterSpacing: 2.5, fontFamily: "'SF Mono','Menlo',monospace",
            }}>
              {sensitive ? formatCardNumber(sensitive.card_number) : ''}
            </div>
          </div>
          {sensitive && (
            <button
              onClick={() => handleCopy(sensitive.card_number, 'number')}
              data-copy="true" className="card-copy-btn"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 30, height: 30, borderRadius: 8,
                background: copied === 'number' ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.15)',
                border: copied === 'number' ? '1px solid rgba(16,185,129,0.4)' : '1px solid rgba(255,255,255,0.2)',
                cursor: 'pointer', transition: 'all 0.15s ease', flexShrink: 0,
              }}
            >
              {copied === 'number'
                ? <CheckIcon size={13} style={{ color: '#10b981' }} />
                : <CopyIcon size={13} style={{ color: 'rgba(255,255,255,0.7)' }} />
              }
            </button>
          )}
        </div>

        {/* Expiry + CVV row with copy icons */}
        <div style={{ display: 'flex', gap: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div>
              <div style={{ fontSize: 10, textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', letterSpacing: 1, marginBottom: 4 }}>
                {t('expiry_label')}
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#fff', fontFamily: "'SF Mono','Menlo',monospace" }}>
                {sensitive ? `${sensitive.expiry_month}/${sensitive.expiry_year.slice(-2)}` : ''}
              </div>
            </div>
            {sensitive && (
              <button
                onClick={() => handleCopy(`${sensitive.expiry_month}/${sensitive.expiry_year}`, 'expiry')}
                data-copy="true" className="card-copy-btn"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 28, height: 28, borderRadius: 7,
                  background: copied === 'expiry' ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.15)',
                  border: copied === 'expiry' ? '1px solid rgba(16,185,129,0.4)' : '1px solid rgba(255,255,255,0.2)',
                  cursor: 'pointer', transition: 'all 0.15s ease', flexShrink: 0,
                }}
              >
                {copied === 'expiry'
                  ? <CheckIcon size={12} style={{ color: '#10b981' }} />
                  : <CopyIcon size={12} style={{ color: 'rgba(255,255,255,0.7)' }} />
                }
              </button>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div>
              <div style={{ fontSize: 10, textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', letterSpacing: 1, marginBottom: 4 }}>
                CVV
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#fff', fontFamily: "'SF Mono','Menlo',monospace" }}>
                {sensitive?.cvv || ''}
              </div>
            </div>
            {sensitive && (
              <button
                onClick={() => handleCopy(sensitive.cvv, 'cvv')}
                data-copy="true" className="card-copy-btn"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 28, height: 28, borderRadius: 7,
                  background: copied === 'cvv' ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.15)',
                  border: copied === 'cvv' ? '1px solid rgba(16,185,129,0.4)' : '1px solid rgba(255,255,255,0.2)',
                  cursor: 'pointer', transition: 'all 0.15s ease', flexShrink: 0,
                }}
              >
                {copied === 'cvv'
                  ? <CheckIcon size={12} style={{ color: '#10b981' }} />
                  : <CopyIcon size={12} style={{ color: 'rgba(255,255,255,0.7)' }} />
                }
              </button>
            )}
          </div>
        </div>
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
