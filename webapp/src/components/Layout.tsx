import { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import BottomNav from './BottomNav';
import Toast from './Toast';
import { useNotifications } from '../hooks/useNotifications';
import { useTheme } from '../contexts/ThemeContext';
import { useLang } from '../contexts/LangContext';
import { ChevronLeftIcon, SunIcon, MoonIcon } from './icons';

interface Props {
  children: ReactNode;
}

type TKey = Parameters<ReturnType<typeof useLang>['t']>[0];

const routeKeys: Record<string, TKey> = {
  '/cards': 'title_cards',
  '/cards/issue': 'title_issue',
  '/deposit': 'title_deposit',
  '/withdraw': 'title_withdraw',
  '/history': 'history_title',
  '/profile': 'title_profile',
  '/referral': 'title_referral',
  '/security': 'title_security',
  '/notifications': 'title_notifications',
  '/support': 'title_support',
  '/exchange': 'title_exchange',
  '/tariffs': 'title_tariffs',
  '/services': 'title_services',
  '/faq': 'title_faq',
};

const rootPaths = ['/', '/cards', '/history', '/services', '/profile'];

export default function Layout({ children }: Props) {
  const { notifications, dismiss } = useNotifications();
  const { isDark, toggleTheme } = useTheme();
  const { lang, toggleLang, t } = useLang();
  const location = useLocation();
  const navigate = useNavigate();

  const showBack = !rootPaths.includes(location.pathname);

  const getTitle = (): string => {
    if (location.pathname === '/') return '';
    if (routeKeys[location.pathname]) return t(routeKeys[location.pathname]);
    if (/^\/cards\/[^/]+\/topup$/.test(location.pathname)) return t('title_card_topup');
    if (/^\/cards\/[^/]+$/.test(location.pathname)) return t('title_card_detail');
    return 'VirtCardPay';
  };
  const title = getTitle();

  return (
    <div className="app-shell">
      {notifications.map((n) => (
        <Toast
          key={n.id}
          message={n.message}
          type={n.type}
          onClose={() => dismiss(n.id)}
        />
      ))}

      {/* Header */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          paddingTop: 'calc(16px + var(--safe-top))',
          position: 'sticky',
          top: 0,
          zIndex: 100,
          background: 'var(--bg-primary)',
          borderBottom: '1px solid var(--border)',
          boxShadow: 'var(--shadow-sm)',
          transition: 'background 0.3s ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: 36 }}>
          {showBack && (
            <button
              onClick={() => navigate(-1)}
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                boxShadow: 'var(--shadow-sm)',
                color: 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'var(--transition-fast)',
              }}
            >
              <ChevronLeftIcon size={20} />
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {title === '' ? (
            <>
              <img src="/public/logo.png" alt="VirtCardPay" style={{ width: 28, height: 28, borderRadius: 8, objectFit: 'cover' }} />
              <span style={{ fontSize: 17, fontWeight: 800, letterSpacing: -0.3, color: 'var(--text-primary)' }}>
                VirtCardPay
              </span>
            </>
          ) : (
            <span style={{ fontSize: 17, fontWeight: 600, letterSpacing: -0.2, color: 'var(--text-primary)' }}>
              {title}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={toggleLang}
            style={{
              height: 36,
              padding: '0 10px',
              borderRadius: 10,
              background: 'var(--bg-glass)',
              border: '1px solid var(--border-glass)',
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: 0.5,
              transition: 'var(--transition-fast)',
            }}
          >
            {lang === 'ru' ? 'RU' : 'EN'}
          </button>
          <button
            onClick={toggleTheme}
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'var(--bg-glass)',
              border: '1px solid var(--border-glass)',
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'var(--transition-fast)',
            }}
          >
            {isDark ? <SunIcon size={18} /> : <MoonIcon size={18} />}
          </button>
        </div>
      </header>

      <main className="page-content">{children}</main>
      <BottomNav />
    </div>
  );
}
