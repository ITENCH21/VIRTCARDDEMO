import { useLocation, useNavigate } from 'react-router-dom';

const tabs = [
  { path: '/', label: 'Home', icon: '\u2302' },
  { path: '/cards', label: 'Cards', icon: '\u2750' },
  { path: '/deposit', label: 'Deposit', icon: '\u2B07' },
  { path: '/withdraw', label: 'Withdraw', icon: '\u2B06' },
  { path: '/history', label: 'History', icon: '\u2630' },
  { path: '/profile', label: 'Profile', icon: '\u2699' },
];

const navStyle: React.CSSProperties = {
  position: 'fixed',
  bottom: 0,
  left: 0,
  right: 0,
  display: 'flex',
  justifyContent: 'space-around',
  alignItems: 'center',
  height: '64px',
  background: 'var(--card-bg)',
  borderTop: '1px solid var(--border-color)',
  zIndex: 100,
  paddingBottom: 'env(safe-area-inset-bottom)',
};

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav style={navStyle}>
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
              gap: '2px',
              background: 'none',
              color: isActive ? 'var(--button-color)' : 'var(--hint-color)',
              fontSize: '20px',
              padding: '4px 12px',
              transition: 'color 0.2s',
            }}
          >
            <span>{tab.icon}</span>
            <span style={{ fontSize: '10px', fontWeight: isActive ? 600 : 400 }}>
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
