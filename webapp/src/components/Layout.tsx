import { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import BottomNav from './BottomNav';
import Toast from './Toast';
import { useNotifications } from '../hooks/useNotifications';
import { useTheme } from '../contexts/ThemeContext';
import { ChevronLeftIcon, SunIcon, MoonIcon } from './icons';

interface Props {
  children: ReactNode;
}

const routeTitles: Record<string, string> = {
  '/': 'VirtCardPay',
  '/cards': 'Мои карты',
  '/cards/issue': 'Новая карта',
  '/deposit': 'Пополнение',
  '/withdraw': 'Вывод',
  '/history': 'История',
  '/profile': 'Профиль',
  '/referral': 'Реферальная программа',
  '/security': 'Безопасность',
  '/notifications': 'Уведомления',
  '/support': 'Поддержка',
  '/exchange': 'Обмен валют',
  '/tariffs': 'Тарифы и лимиты',
};

function getTitle(pathname: string): string {
  if (routeTitles[pathname]) return routeTitles[pathname];
  if (/^\/cards\/[^/]+\/topup$/.test(pathname)) return 'Пополнить карту';
  if (/^\/cards\/[^/]+$/.test(pathname)) return 'Детали карты';
  return 'VirtCardPay';
}

const rootPaths = ['/', '/cards', '/history', '/profile'];

export default function Layout({ children }: Props) {
  const { notifications, dismiss } = useNotifications();
  const { isDark, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  const showBack = !rootPaths.includes(location.pathname);
  const title = getTitle(location.pathname);

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
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          background: 'var(--header-bg)',
          borderBottom: '1px solid var(--border-glass)',
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
                background: 'var(--bg-glass)',
                border: '1px solid var(--border-glass)',
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

        <div
          style={{
            fontSize: 17,
            fontWeight: 600,
            letterSpacing: -0.2,
            color: 'var(--text-primary)',
          }}
        >
          {title}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
            {isDark ? <MoonIcon size={18} /> : <SunIcon size={18} />}
          </button>
        </div>
      </header>

      <main className="page-content">{children}</main>
      <BottomNav />
    </div>
  );
}
