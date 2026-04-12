import { useState } from 'react';
import { CopyIcon, CheckIcon, ShareIcon, UsersIcon, TrendingUpIcon, GiftIcon } from '../components/icons';

export default function ReferralPage() {
  const [copied, setCopied] = useState(false);

  // Mock data
  const referralLink = 'https://virtcardpay.app/ref/abc123xyz';
  const totalReferrals = 12;
  const activeReferrals = 8;
  const earnedBonus = '125.50 USDT';

  const recentReferrals = [
    { id: 1, name: 'John Doe', joinedDate: '2026-03-10', status: 'active', earned: '10.00 USDT' },
    { id: 2, name: 'Jane Smith', joinedDate: '2026-03-08', status: 'active', earned: '10.00 USDT' },
    { id: 3, name: 'Mike Johnson', joinedDate: '2026-02-28', status: 'inactive', earned: '5.00 USDT' },
    { id: 4, name: 'Sarah Williams', joinedDate: '2026-02-25', status: 'active', earned: '10.00 USDT' },
    { id: 5, name: 'Alex Chen', joinedDate: '2026-02-15', status: 'active', earned: '10.00 USDT' },
  ];

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API not available
    }
  };

  const handleShareTelegram = () => {
    const message = encodeURIComponent(`🎁 Присоединяйся к VirtCardPay! Получай бонусы за каждого приглашенного друга. ${referralLink}`);
    window.open(`https://t.me/share/url?url=${message}`, '_blank');
  };

  return (
    <div className="page">
      <div className="page-narrow">
      <h1 className="page-title">Реферальная программа</h1>

      {/* Stats Cards */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24,
      }}>
        <div className="glass-card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <UsersIcon size={18} style={{ color: 'var(--accent-1)' }} />
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Всего рефералов</span>
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>
            {totalReferrals}
          </div>
        </div>

        <div className="glass-card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <TrendingUpIcon size={18} style={{ color: 'var(--success)' }} />
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Активных</span>
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>
            {activeReferrals}
          </div>
        </div>

        <div className="glass-card" style={{ padding: 16, gridColumn: '1 / -1' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <GiftIcon size={18} style={{ color: 'var(--warning)' }} />
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Заработано</span>
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>
            {earnedBonus}
          </div>
        </div>
      </div>

      {/* Referral Link Section */}
      <div className="glass-card" style={{ padding: 20, marginBottom: 24 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>
          Ваша реферальная ссылка
        </h2>

        <div style={{
          display: 'flex', gap: 8, marginBottom: 12,
        }}>
          <div style={{
            flex: 1, padding: '12px 14px',
            background: 'var(--bg-glass)', border: '1px solid var(--border-glass)',
            borderRadius: 'var(--radius-md)',
            fontSize: 12, fontFamily: "'SF Mono','Menlo',monospace",
            color: 'var(--text-primary)', wordBreak: 'break-all', lineHeight: 1.4,
          }}>
            {referralLink}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-primary"
            onClick={handleCopyLink}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          >
            {copied ? <><CheckIcon size={16} /> Скопировано!</> : <><CopyIcon size={16} /> Копировать</>}
          </button>
          <button
            className="btn btn-secondary"
            onClick={handleShareTelegram}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          >
            <ShareIcon size={16} /> Telegram
          </button>
        </div>
      </div>

      {/* Bonus Structure */}
      <div className="glass-card" style={{ padding: 20, marginBottom: 24 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 14 }}>
          Структура бонусов
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '10px 0', borderBottom: '1px solid var(--border-glass)',
          }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Первый депозит друга</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-1)' }}>+10 USDT</span>
          </div>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '10px 0', borderBottom: '1px solid var(--border-glass)',
          }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Каждый топап карты</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-1)' }}>+0.5% от суммы</span>
          </div>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '10px 0',
          }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Месячный бонус за активность</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-1)' }}>+5 USDT</span>
          </div>
        </div>
      </div>

      {/* Recent Referrals */}
      <div>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>
          Последние приглашения
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {recentReferrals.map((ref) => (
            <div
              key={ref.id}
              className="glass-card"
              style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
                  {ref.name}
                </div>
                <div style={{
                  fontSize: 12, color: 'var(--text-muted)',
                  display: 'flex', alignItems: 'center', gap: 8, marginTop: 2,
                }}>
                  <span>{ref.joinedDate}</span>
                  <span style={{
                    display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
                    background: ref.status === 'active' ? 'var(--success)' : 'var(--text-muted)',
                  }} />
                  <span>{ref.status === 'active' ? 'Активен' : 'Неактивен'}</span>
                </div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-1)' }}>
                {ref.earned}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Info Box */}
      <div className="glass-card" style={{
        padding: 14, marginTop: 20,
        background: 'linear-gradient(135deg, rgba(99,102,241,0.1) 0%, rgba(168,85,247,0.05) 100%)',
        border: '1px solid rgba(99,102,241,0.2)',
      }}>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          💡 <strong>Совет:</strong> Чем больше активных рефералов, тем больше пассивного дохода! Не забывайте делиться ссылкой в социальных сетях и мессенджерах.
        </p>
      </div>
      </div>
    </div>
  );
}
