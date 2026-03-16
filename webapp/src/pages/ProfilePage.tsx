import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { apiFetch } from '../api/client';
import Spinner from '../components/Spinner';
import { UserIcon, MailIcon, PhoneIcon, MessageIcon, LogOutIcon } from '../components/icons';
import { useLang } from '../contexts/LangContext';

interface Profile {
  name: string;
  email: string | null;
  phone: string | null;
  telegram_username: string | null;
}

export default function ProfilePage() {
  const { t } = useLang();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [dirty, setDirty] = useState(false);

  const menuItems = [
    {
      path: '/security',
      label: t('profile_menu_security'),
      desc: t('profile_menu_security_desc'),
      color: '#6366f1',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      ),
    },
    {
      path: '/notifications',
      label: t('profile_menu_notifications'),
      desc: t('profile_menu_notifications_desc'),
      color: '#f59e0b',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      ),
    },
    {
      path: '/exchange',
      label: t('profile_menu_exchange'),
      desc: t('profile_menu_exchange_desc'),
      color: '#06b6d4',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
          <polyline points="17 1 21 5 17 9" />
          <path d="M3 11V9a4 4 0 0 1 4-4h14" />
          <polyline points="7 23 3 19 7 15" />
          <path d="M21 13v2a4 4 0 0 1-4 4H3" />
        </svg>
      ),
    },
    {
      path: '/tariffs',
      label: t('profile_menu_tariffs'),
      desc: t('profile_menu_tariffs_desc'),
      color: '#8b5cf6',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
          <rect x="1" y="4" width="22" height="16" rx="2" />
          <line x1="1" y1="10" x2="23" y2="10" />
        </svg>
      ),
    },
    {
      path: '/faq',
      label: t('profile_menu_faq'),
      desc: t('profile_menu_faq_desc'),
      color: '#f97316',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      ),
    },
    {
      path: '/support',
      label: t('profile_menu_support'),
      desc: t('profile_menu_support_desc'),
      color: '#2AABEE',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      ),
    },
  ];

  useEffect(() => {
    apiFetch<Profile>('/profile')
      .then((p) => {
        setProfile(p);
        setName(p.name || '');
        setEmail(p.email || '');
        setPhone(p.phone || '');
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const updated = await apiFetch<Profile>('/profile', {
        method: 'PATCH',
        body: JSON.stringify({ name, email: email || null, phone: phone || null }),
      });
      setProfile(updated);
      setDirty(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="page"><Spinner /></div>;

  const initials = (profile?.name || 'U').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="page">
      {/* Avatar */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 28 }}>
        <div style={{
          width: 80, height: 80, borderRadius: '50%',
          background: 'var(--accent-gradient)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 28, fontWeight: 700, color: '#fff',
          boxShadow: '0 0 0 4px var(--bg-primary), 0 0 0 6px rgba(99,102,241,0.3)',
        }}>
          {initials}
        </div>
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginTop: 14 }}>
          {profile?.name || 'User'}
        </div>
        {profile?.telegram_username && (
          <div style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 2 }}>
            @{profile.telegram_username}
          </div>
        )}
      </div>

      {/* Editable Fields */}
      <div className="glass-card" style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 8 }}>
            <UserIcon size={16} /> {t('profile_name_label')}
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); setDirty(true); }}
            className="form-input"
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 8 }}>
            <MailIcon size={16} /> Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setDirty(true); }}
            placeholder="your@email.com"
            className="form-input"
          />
        </div>

        <div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 8 }}>
            <PhoneIcon size={16} /> {t('profile_phone_label')}
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => { setPhone(e.target.value); setDirty(true); }}
            placeholder="+7 (999) 123-45-67"
            className="form-input"
          />
        </div>
      </div>

      {/* Telegram Info */}
      {profile?.telegram_username && (
        <div className="glass-card" style={{ padding: '14px 20px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          <MessageIcon size={18} style={{ color: 'var(--accent-1)' }} />
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Telegram</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>@{profile.telegram_username}</div>
          </div>
        </div>
      )}

      {error && <p className="error-text">{error}</p>}

      {dirty && (
        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={saving}
          style={{ marginBottom: 16 }}
        >
          {saving ? t('profile_saving') : t('profile_save')}
        </button>
      )}

      {/* Menu Items */}
      <div style={{ marginTop: dirty ? 0 : 8, marginBottom: 16 }}>
        <div className="section-title" style={{ marginBottom: 12 }}>{t('profile_section_title')}</div>
        <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
          {menuItems.map((item, idx) => (
            <div
              key={item.path}
              onClick={() => navigate(item.path)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '14px 18px',
                cursor: 'pointer',
                borderBottom: idx < menuItems.length - 1 ? '1px solid var(--border-glass)' : 'none',
                transition: 'background 0.15s ease',
              }}
            >
              <div style={{
                width: 40, height: 40, borderRadius: 12,
                background: `${item.color}15`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: item.color, flexShrink: 0,
              }}>
                {item.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                  {item.label}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  {item.desc}
                </div>
              </div>
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" width="16" height="16" style={{ flexShrink: 0 }}>
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </div>
          ))}
        </div>
      </div>

      {/* Logout */}
      <button
        className="btn btn-danger"
        onClick={logout}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
      >
        <LogOutIcon size={18} /> {t('logout')}
      </button>
    </div>
  );
}
