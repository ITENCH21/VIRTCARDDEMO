import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { apiFetch } from '../api/client';
import { setTokens } from '../api/client';

declare global {
  interface Window {
    onTelegramAuth?: (user: Record<string, string | number>) => void;
  }
}

export default function LoginPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { loginTelegram } = useAuth();
  const [devTgId, setDevTgId] = useState('');
  const [devLoading, setDevLoading] = useState(false);
  const [devError, setDevError] = useState('');

  useEffect(() => {
    window.onTelegramAuth = async (user) => {
      await loginTelegram(user);
    };

    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.async = true;
    script.setAttribute('data-telegram-login', 'YourBotName');
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-onauth', 'onTelegramAuth(user)');
    script.setAttribute('data-request-access', 'write');
    containerRef.current?.appendChild(script);

    return () => {
      delete window.onTelegramAuth;
    };
  }, [loginTelegram]);

  const handleDevLogin = async () => {
    const tgId = parseInt(devTgId, 10);
    if (!tgId) return;
    setDevLoading(true);
    setDevError('');
    try {
      const res = await apiFetch<{ access_token: string; refresh_token: string }>('/auth/dev-login', {
        method: 'POST',
        body: JSON.stringify({ telegram_id: tgId }),
      });
      setTokens(res.access_token, res.refresh_token);
      window.location.reload();
    } catch (e: unknown) {
      setDevError(e instanceof Error ? e.message : 'Login failed');
    } finally {
      setDevLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', padding: 24, textAlign: 'center',
    }}>
      {/* Brand */}
      <div style={{ marginBottom: 40 }}>
        <h1 style={{
          fontSize: 36, fontWeight: 800, letterSpacing: -1,
          background: 'var(--accent-gradient)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          marginBottom: 8,
        }}>
          YeezyPay
        </h1>
        <p style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          Sign in with your Telegram account to get started
        </p>
      </div>

      {/* Telegram Widget */}
      <div ref={containerRef} style={{ marginBottom: 32 }} />

      {/* Dev login */}
      <div style={{
        padding: 20,
        background: 'var(--bg-glass)',
        border: '1px dashed var(--border-glass)',
        borderRadius: 'var(--radius-lg)',
        width: '100%', maxWidth: 300,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>Dev Login (DEBUG mode)</p>
        <input
          type="text"
          inputMode="numeric"
          value={devTgId}
          onChange={(e) => setDevTgId(e.target.value)}
          placeholder="Telegram ID"
          className="form-input"
          style={{ marginBottom: 10, textAlign: 'center' }}
        />
        <button
          className="btn btn-secondary"
          onClick={handleDevLogin}
          disabled={devLoading || !devTgId}
          style={{ fontSize: 14 }}
        >
          {devLoading ? 'Logging in...' : 'Dev Login'}
        </button>
        {devError && <p className="error-text" style={{ marginTop: 8 }}>{devError}</p>}
      </div>
    </div>
  );
}
