import { useLocation, useNavigate } from 'react-router-dom';
import { HomeIcon, CreditCardIcon, ClockIcon, UserIcon } from './icons';

const tabs = [
  { path: '/', label: 'Home', Icon: HomeIcon },
  { path: '/cards', label: 'Cards', Icon: CreditCardIcon },
  { path: '/history', label: 'History', Icon: ClockIcon },
  { path: '/profile', label: 'Profile', Icon: UserIcon },
];

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

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
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        background: 'var(--tabbar-bg)',
        borderTop: '1px solid var(--border-glass)',
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
                    background: 'var(--accent-gradient)',
                    borderRadius: 2,
                  }}
                />
              )}
              <tab.Icon
                size={22}
                style={{
                  color: isActive ? 'var(--accent-1)' : 'var(--text-muted)',
                  transition: 'var(--transition-fast)',
                }}
              />
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 500,
                  color: isActive ? 'var(--accent-1)' : 'var(--text-muted)',
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
