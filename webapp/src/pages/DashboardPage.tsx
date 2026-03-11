import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useBalance } from '../hooks/useBalance';
import { useCards } from '../hooks/useCards';
import { fetchOperations, OperationResponse } from '../api/operations';
import Spinner from '../components/Spinner';
import VirtualCard from '../components/VirtualCard';
import OperationListItem from '../components/OperationListItem';
import { ArrowDownIcon, ArrowUpIcon, PlusIcon, CreditCardIcon } from '../components/icons';
import { formatAmount } from '../lib/format';

export default function DashboardPage() {
  const { client } = useAuth();
  const { data, loading, error } = useBalance();
  const { cards } = useCards();
  const navigate = useNavigate();
  const [recentOps, setRecentOps] = useState<OperationResponse[]>([]);

  useEffect(() => {
    fetchOperations(0, 3).then((res) => setRecentOps(res.items)).catch(() => {});
  }, []);

  const activeCards = cards.filter((c) => c.status === 'A' || c.status === 'R');

  return (
    <div className="page">
      {loading && <Spinner />}
      {error && <p className="error-text">{error}</p>}

      {data && (
        <>
          {/* Balance Hero */}
          <div
            style={{
              background: 'var(--balance-hero-bg)',
              backdropFilter: 'blur(20px)',
              border: '1px solid var(--balance-hero-border)',
              borderRadius: 'var(--radius-xl)',
              padding: '28px 24px',
              margin: '8px 0 24px',
              position: 'relative',
              overflow: 'hidden',
              boxShadow: 'var(--shadow-glow)',
            }}
          >
            <div style={{
              position: 'absolute', top: '-60%', right: '-30%', width: 200, height: 200,
              background: 'radial-gradient(circle, var(--balance-hero-orb1), transparent 70%)',
              borderRadius: '50%', animation: 'orbFloat 8s ease-in-out infinite', pointerEvents: 'none',
            }} />
            <div style={{
              position: 'absolute', bottom: '-40%', left: '-20%', width: 160, height: 160,
              background: 'radial-gradient(circle, var(--balance-hero-orb2), transparent 70%)',
              borderRadius: '50%', animation: 'orbFloat 12s ease-in-out infinite reverse', pointerEvents: 'none',
            }} />

            <div style={{
              fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6,
              fontWeight: 500, textTransform: 'uppercase', letterSpacing: 1,
              position: 'relative', zIndex: 1,
            }}>
              {client?.name ? `Hi, ${client.name.split(' ')[0]}` : 'Total Balance'}
            </div>

            {data.accounts.map((acc) => (
              <div key={acc.id} style={{ position: 'relative', zIndex: 1 }}>
                <div style={{
                  fontSize: 38, fontWeight: 700, letterSpacing: -1.5,
                  background: 'var(--balance-text-gradient)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}>
                  {formatAmount(acc.balance, acc.currency_symbol)}
                </div>
                {acc.balance !== acc.available && (
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                    Available: {formatAmount(acc.available, acc.currency_symbol)}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Quick Actions */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 28 }}>
            {[
              { label: 'Deposit', Icon: ArrowDownIcon, bg: 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(16,185,129,0.05))', color: '#10b981', path: '/deposit' },
              { label: 'Withdraw', Icon: ArrowUpIcon, bg: 'linear-gradient(135deg, rgba(239,68,68,0.15), rgba(239,68,68,0.05))', color: '#ef4444', path: '/withdraw' },
              { label: 'New Card', Icon: PlusIcon, bg: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(99,102,241,0.05))', color: '#6366f1', path: '/cards/issue' },
              { label: 'My Cards', Icon: CreditCardIcon, bg: 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(245,158,11,0.05))', color: '#f59e0b', path: '/cards' },
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
                  width: 52, height: 52, borderRadius: 16,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: action.bg, color: action.color,
                  transition: 'var(--transition-normal)',
                }}>
                  <action.Icon size={22} />
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500 }}>
                  {action.label}
                </div>
              </div>
            ))}
          </div>

          {/* Active Cards Carousel */}
          {activeCards.length > 0 && (
            <>
              <div className="section-header">
                <div className="section-title">Active Cards</div>
                <div className="section-link" onClick={() => navigate('/cards')}>All Cards</div>
              </div>
              <div className="scroll-horizontal" style={{ marginBottom: 28 }}>
                {activeCards.slice(0, 5).map((card, i) => (
                  <div key={card.id} style={{ minWidth: 300, flexShrink: 0 }}>
                    <VirtualCard
                      name={card.name}
                      last4={card.last4}
                      balance={card.balance}
                      currencySymbol={card.currency_symbol}
                      variant={i}
                      onClick={() => navigate(`/cards/${card.id}`)}
                    />
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Recent Activity */}
          {recentOps.length > 0 && (
            <>
              <div className="section-header">
                <div className="section-title">Recent Activity</div>
                <div className="section-link" onClick={() => navigate('/history')}>See All</div>
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
