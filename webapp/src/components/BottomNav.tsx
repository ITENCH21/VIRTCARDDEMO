import { useLocation, useNavigate } from 'react-router-dom';
import { HomeIcon, CreditCardIcon, ClockIcon, UserIcon, GridIcon } from './icons';
import { useLang } from '../contexts/LangContext';

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useLang();

  const tabs = [
    { path: '/', label: t('nav_home'), Icon: HomeIcon, color: '#3b82f6' },
    { path: '/cards', label: t('nav_cards'), Icon: CreditCardIcon, color: '#06b6d4' },
    { path: '/history', label: t('nav_history'), Icon: ClockIcon, color: '#f59e0b' },
    { path: '/services', label: t('nav_services'), Icon: GridIcon, color: '#8b5cf6' },
    { path: '/profile', label: t('nav_profile'), Icon: UserIcon, color: '#64748b' },
  ];

  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: 430,
        zIndex: 200,
        padding: '8px 16px',
        paddingBottom: 'calc(8px + var(--safe-bottom))',
        background: 'var(--bg-primary)',
        borderTop: '1px solid var(--border)',
        boxShadow: '0 -4px 16px rgba(0,0,0,0.08)',
        transition: 'background 0.3s ease',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
        {tabs.map((tab) => {
          const isActive =
            tab.path === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(tab.path);

          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
                padding: '6px 12px',
                cursor: 'pointer',
                borderRadius: 12,
                background: 'none',
                position: 'relative',
                WebkitTapHighlightColor: 'transparent',
                transition: 'var(--transition-fast)',
              }}
            >
              {isActive && (
                <span
                  style={{
                    position: 'absolute',
                    top: -8,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 20,
                    height: 3,
                    background: tab.color,
                    borderRadius: 2,
                  }}
                />
              )}
              <tab.Icon
                size={22}
                style={{
                  color: isActive ? tab.color : 'var(--text-muted)',
                  transition: 'var(--transition-fast)',
                }}
              />
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 500,
                  color: isActive ? tab.color : 'var(--text-muted)',
                  transition: 'var(--transition-fast)',
                }}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
