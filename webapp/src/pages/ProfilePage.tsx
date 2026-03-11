import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { apiFetch } from '../api/client';
import Spinner from '../components/Spinner';
import { UserIcon, MailIcon, PhoneIcon, MessageIcon, LogOutIcon } from '../components/icons';

interface Profile {
  name: string;
  email: string | null;
  phone: string | null;
  telegram_username: string | null;
}

export default function ProfilePage() {
  const { logout } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [dirty, setDirty] = useState(false);

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
        {/* Name */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 8 }}>
            <UserIcon size={16} /> Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); setDirty(true); }}
            className="form-input"
          />
        </div>

        {/* Email */}
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

        {/* Phone */}
        <div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 8 }}>
            <PhoneIcon size={16} /> Phone
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => { setPhone(e.target.value); setDirty(true); }}
            placeholder="+1234567890"
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
          style={{ marginBottom: 12 }}
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      )}

      {/* Logout */}
      <button
        className="btn btn-danger"
        onClick={logout}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: dirty ? 0 : 12 }}
      >
        <LogOutIcon size={18} /> Log Out
      </button>
    </div>
  );
}
