import { ReactNode, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../contexts/ThemeContext';
import { useLang } from '../contexts/LangContext';
import { useNotifications } from '../hooks/useNotifications';
import Toast from './Toast';
import {
  HomeIcon,
  CreditCardIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  ClockIcon,
  TrendingUpIcon,
  MessageIcon,
  UserIcon,
  LogOutIcon,
  SunIcon,
  MoonIcon,
  GridIcon,
} from './icons';

interface Props {
  children: ReactNode;
}

export default function DesktopLayout({ children }: Props) {
  const { client, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { lang, toggleLang, t } = useLang();
  const { notifications, dismiss } = useNotifications();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navItems = [
    { path: '/', label: t('nav_home'), Icon: HomeIcon, color: '#3b82f6' },
    { path: '/cards', label: t('nav_cards'), Icon: CreditCardIcon, color: '#06b6d4' },
    { path: '/deposit', label: t('action_deposit'), Icon: ArrowDownIcon, color: '#10b981' },
    { path: '/withdraw', label: t('action_withdraw'), Icon: ArrowUpIcon, color: '#ef4444' },
    { path: '/history', label: t('nav_history'), Icon: ClockIcon, color: '#f59e0b' },
    { path: '/services', label: t('nav_services'), Icon: GridIcon, color: '#8b5cf6' },
    { path: '/tariffs', label: t('title_tariffs'), Icon: TrendingUpIcon, color: '#6366f1' },
    { path: '/support', label: t('title_support'), Icon: MessageIcon, color: '#2AABEE' },
  ];

  const routeKeys: Record<string, Parameters<typeof t>[0]> = {
    '/': 'nav_home',
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

  const getTitle = (pathname: string): string => {
    if (routeKeys[pathname]) return t(routeKeys[pathname]);
    if (/^\/cards\/[^/]+\/topup$/.test(pathname)) return t('title_card_topup');
    if (/^\/cards\/[^/]+$/.test(pathname)) return t('title_card_detail');
    return 'VirtCardPay';
  };

  const title = getTitle(location.pathname);

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const handleNav = (path: string) => {
    navigate(path);
    setSidebarOpen(false);
  };

  const handleLogout = () => {
    logout();
    setSidebarOpen(false);
  };

  return (
    <div className="lk-shell">
      {notifications.map((n) => (
        <Toast
          key={n.id}
          message={n.message}
          type={n.type}
          onClose={() => dismiss(n.id)}
        />
      ))}

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="lk-sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`lk-sidebar ${sidebarOpen ? 'open' : ''}`}>
        {/* Brand */}
        <div className="lk-sidebar-brand" onClick={() => handleNav('/')}>
          <span className="lk-sidebar-brand-text">
            <span style={{ color: '#10b981' }}>Virt</span>
            <span style={{ color: '#3B82F6' }}>Card</span>
            <span style={{ color: '#F59E0B' }}>Pay</span>
          </span>
        </div>

        {/* Navigation */}
        <nav className="lk-sidebar-nav">
          {navItems.map((item) => {
            const active = isActive(item.path);
            return (
              <button
                key={item.path}
                className={`lk-sidebar-item ${active ? 'active' : ''}`}
                onClick={() => handleNav(item.path)}
                style={active ? {
                  background: `linear-gradient(135deg, ${item.color}, ${item.color}dd)`,
                  boxShadow: `0 4px 16px ${item.color}40`,
                } : undefined}
              >
                <span className="lk-sidebar-icon-wrap" style={{ background: active ? 'rgba(255,255,255,0.2)' : `${item.color}18` }}>
                  <item.Icon size={18} style={{ color: active ? '#fff' : item.color }} />
                </span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Bottom section */}
        <div className="lk-sidebar-bottom">
          <button
            className={`lk-sidebar-item ${isActive('/profile') ? 'active' : ''}`}
            onClick={() => handleNav('/profile')}
            style={isActive('/profile') ? {
              background: 'linear-gradient(135deg, #64748b, #64748bdd)',
              boxShadow: '0 4px 16px rgba(100,116,139,0.25)',
            } : undefined}
          >
            <span className="lk-sidebar-icon-wrap" style={{ background: isActive('/profile') ? 'rgba(255,255,255,0.2)' : 'rgba(100,116,139,0.1)' }}>
              <UserIcon size={18} style={{ color: isActive('/profile') ? '#fff' : '#64748b' }} />
            </span>
            <span>{lang === 'ru' ? 'Настройки' : 'Settings'}</span>
          </button>
          <button className="lk-sidebar-item lk-sidebar-logout" onClick={handleLogout}>
            <span className="lk-sidebar-icon-wrap" style={{ background: 'rgba(239,68,68,0.1)' }}>
              <LogOutIcon size={18} style={{ color: '#ef4444' }} />
            </span>
            <span>{t('logout')}</span>
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div className="lk-main">
        {/* Top bar */}
        <header className="lk-topbar">
          <div className="lk-topbar-left">
            <button
              className="lk-hamburger"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label={lang === 'ru' ? 'Меню' : 'Menu'}
            >
              <span />
              <span />
              <span />
            </button>
            <h1 className="lk-topbar-title">{title}</h1>
          </div>

          <div className="lk-topbar-right">
            <button
              className="lk-topbar-btn"
              onClick={toggleLang}
              style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.5, width: 'auto', padding: '0 12px', boxShadow: '0 0 10px rgba(16,185,129,0.35)', borderColor: 'rgba(16,185,129,0.3)', color: '#10b981' }}
            >
              {lang === 'ru' ? 'RU' : 'EN'}
            </button>
            <button
              className="lk-topbar-btn"
              onClick={toggleTheme}
              aria-label="Переключить тему"
              style={{ boxShadow: '0 0 10px rgba(59,130,246,0.35)', borderColor: 'rgba(59,130,246,0.3)', color: '#3b82f6' }}
            >
              {isDark ? <SunIcon size={18} /> : <MoonIcon size={18} />}
            </button>
            {client && (
              <div
                className="lk-topbar-user"
                onClick={() => navigate('/profile')}
                style={{ boxShadow: '0 0 10px rgba(245,158,11,0.35)', borderColor: 'rgba(245,158,11,0.3)' }}
              >
                <div className="lk-topbar-avatar">
                  {(client.name || 'U').charAt(0).toUpperCase()}
                </div>
                <span className="lk-topbar-username">{client.name}</span>
              </div>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="lk-content">{children}</main>
      </div>

      <style>{`
        /* ═══════════════════════════════════════════
           DESKTOP LAYOUT — LK Shell
           ═══════════════════════════════════════════ */
        .lk-shell {
          display: flex;
          height: 100vh;
          overflow: hidden;
          position: relative;
          z-index: 1;
        }

        /* ─── Sidebar ────────────────────────────── */
        .lk-sidebar {
          width: 260px;
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          background: var(--bg-card);
          border-right: none;
          padding: 16px 12px;
          margin: 16px 0 16px 16px;
          border-radius: var(--radius-xl);
          box-shadow: var(--shadow-card);
          height: calc(100vh - 32px);
          overflow-y: auto;
          transition: background 0.3s ease, box-shadow 0.3s ease;
          z-index: 300;
        }

        .lk-sidebar-brand {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 4px 12px 24px;
          cursor: pointer;
          user-select: none;
        }

        .lk-sidebar-logo {
          width: 32px;
          height: 32px;
          flex-shrink: 0;
        }

        .lk-sidebar-brand-text {
          font-size: 22px;
          font-weight: 800;
          letter-spacing: -0.3px;
        }

        /* Nav items */
        .lk-sidebar-nav {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .lk-sidebar-item {
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
          padding: 11px 16px;
          font-size: 14px;
          font-weight: 500;
          color: var(--text-secondary);
          background: var(--bg-input);
          border: none;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s ease;
          text-align: left;
          box-shadow: var(--shadow-inset);
        }
        .lk-sidebar-item:hover {
          color: var(--text-primary);
        }
        .lk-sidebar-item.active {
          color: #fff;
        }
        .lk-sidebar-item.active svg {
          color: #fff;
        }

        .lk-sidebar-icon-wrap {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: background 0.2s ease;
        }

        .lk-sidebar-bottom {
          border-top: 1px solid var(--border);
          padding-top: 12px;
          margin-top: 12px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .lk-sidebar-logout {
          color: var(--danger);
        }
        .lk-sidebar-logout:hover {
          background: rgba(239,68,68,0.1);
          color: var(--danger);
        }

        /* Overlay for mobile */
        .lk-sidebar-overlay {
          display: none;
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.5);
          z-index: 250;
          animation: fadeIn 0.2s ease;
        }

        /* ─── Main Area ──────────────────────────── */
        .lk-main {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-width: 0;
          height: 100vh;
          overflow-y: auto;
        }

        /* Top bar */
        .lk-topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 32px;
          position: sticky;
          top: 0;
          z-index: 100;
          background: var(--header-bg);
          border-bottom: 1px solid var(--border);
          transition: background 0.3s ease;
        }

        .lk-topbar-left {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .lk-topbar-title {
          font-size: 20px;
          font-weight: 700;
          color: var(--text-primary);
          letter-spacing: -0.3px;
        }

        .lk-topbar-right {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .lk-topbar-btn {
          width: 40px;
          height: 40px;
          border-radius: 12px;
          background: var(--bg-card);
          border: none;
          color: var(--text-secondary);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: var(--shadow-sm);
        }
        .lk-topbar-btn:hover {
          box-shadow: var(--shadow-md);
          color: var(--accent-1);
        }

        .lk-topbar-user {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 6px 14px 6px 6px;
          background: var(--bg-card);
          border: none;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: var(--shadow-sm);
        }
        .lk-topbar-user:hover {
          box-shadow: var(--shadow-md);
        }

        .lk-topbar-avatar {
          width: 32px;
          height: 32px;
          border-radius: 10px;
          background: var(--accent-gradient);
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          font-weight: 700;
          flex-shrink: 0;
        }

        .lk-topbar-username {
          font-size: 14px;
          font-weight: 600;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 150px;
        }

        /* Hamburger — hidden on desktop */
        .lk-hamburger {
          display: none;
          flex-direction: column;
          gap: 5px;
          padding: 8px;
          background: none;
          border: none;
          cursor: pointer;
        }
        .lk-hamburger span {
          display: block;
          width: 22px;
          height: 2px;
          background: var(--text-primary);
          border-radius: 2px;
          transition: all 0.25s ease;
        }

        /* Content */
        .lk-content {
          flex: 1;
          padding: 32px;
          max-width: 1200px;
          width: 100%;
          margin: 0 auto;
          animation: fadeSlideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        /* .page override moved to globals.css */

        /* ─── Mobile ─────────────────────────────── */
        @media (max-width: 768px) {
          .lk-shell {
            height: auto;
            overflow: visible;
          }
          .lk-main {
            height: auto;
            overflow-y: visible;
          }
          .lk-sidebar {
            position: fixed;
            left: -280px;
            top: 0;
            height: 100vh;
            margin: 0;
            border-radius: 0;
            z-index: 300;
            transition: left 0.3s cubic-bezier(0.4, 0, 0.2, 1),
                        background 0.3s ease;
            background: var(--bg-card);
            box-shadow: 8px 0 24px rgba(0,0,0,0.15);
          }
          .lk-sidebar.open {
            left: 0;
          }

          .lk-sidebar-overlay {
            display: block;
          }

          .lk-hamburger {
            display: flex;
          }

          .lk-topbar {
            padding: 12px 16px;
          }

          .lk-topbar-title {
            font-size: 17px;
          }

          .lk-topbar-username {
            display: none;
          }

          .lk-topbar-user {
            padding: 6px;
          }

          .lk-content {
            padding: 16px;
          }
        }

        /* ─── Tablet ─────────────────────────────── */
        @media (min-width: 769px) and (max-width: 1024px) {
          .lk-sidebar {
            width: 220px;
            padding: 20px 8px;
          }
          .lk-content {
            padding: 24px;
          }
        }
      `}</style>
    </div>
  );
}
