import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { apiFetch } from '../api/client';
import Spinner from '../components/Spinner';

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

  return (
    <div className="page">
      <h1 className="page-title">Profile</h1>

      {profile?.telegram_username && (
        <p className="text-hint mb-16">@{profile.telegram_username}</p>
      )}

      <div className="input-group">
        <label>Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => { setName(e.target.value); setDirty(true); }}
        />
      </div>

      <div className="input-group">
        <label>Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setDirty(true); }}
          placeholder="your@email.com"
        />
      </div>

      <div className="input-group">
        <label>Phone</label>
        <input
          type="tel"
          value={phone}
          onChange={(e) => { setPhone(e.target.value); setDirty(true); }}
          placeholder="+1234567890"
        />
      </div>

      {error && <p className="error-text">{error}</p>}

      {dirty && (
        <button
          className="btn btn-primary mt-16"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      )}

      <button className="btn btn-secondary mt-24" onClick={logout}>
        Log Out
      </button>
    </div>
  );
}
