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
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '24px',
      textAlign: 'center',
    }}>
      <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '8px' }}>
        Virtual Cards
      </h1>
      <p className="text-hint mb-16">
        Sign in with your Telegram account to get started
      </p>
      <div ref={containerRef} />

      {/* Dev login — only works when backend DEBUG=true */}
      <div style={{
        marginTop: '48px',
        padding: '16px',
        border: '1px dashed var(--border-color)',
        borderRadius: '12px',
        width: '100%',
        maxWidth: '300px',
      }}>
        <p className="text-hint mb-8" style={{ fontSize: '12px' }}>Dev Login (DEBUG mode)</p>
        <input
          type="text"
          inputMode="numeric"
          value={devTgId}
          onChange={(e) => setDevTgId(e.target.value)}
          placeholder="Telegram ID"
          style={{
            width: '100%',
            padding: '10px',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            fontSize: '14px',
            marginBottom: '8px',
          }}
        />
        <button
          className="btn btn-secondary"
          onClick={handleDevLogin}
          disabled={devLoading || !devTgId}
          style={{ fontSize: '14px', padding: '10px' }}
        >
          {devLoading ? 'Logging in...' : 'Dev Login'}
        </button>
        {devError && <p className="error-text">{devError}</p>}
      </div>
    </div>
  );
}
