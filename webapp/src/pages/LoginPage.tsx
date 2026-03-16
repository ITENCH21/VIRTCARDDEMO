import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { setTokens } from '../api/client';
import {
  getWebAuthnLoginOptions,
  completeWebAuthnLogin,
} from '../api/auth';

declare global {
  interface Window {
    onTelegramAuth?: (user: Record<string, string | number>) => void;
  }
}

type AuthTab = 'telegram' | 'email' | 'pin' | 'biometric';

const TELEGRAM_BOT_USERNAME =
  import.meta.env.VITE_TELEGRAM_BOT_USERNAME || 'VirtCardPay_bot';

/* ─── Helpers ─────────────────────────────────────────── */

function base64urlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlDecode(str: string): ArrayBuffer {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/* ─── Sub-components ──────────────────────────────────── */

function TelegramLogin({ onAuth }: { onAuth: (user: Record<string, string | number>) => Promise<void> }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    window.onTelegramAuth = async (user) => {
      setLoading(true);
      setError('');
      try {
        await onAuth(user);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Ошибка авторизации');
      } finally {
        setLoading(false);
      }
    };

    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.async = true;
    script.setAttribute('data-telegram-login', TELEGRAM_BOT_USERNAME);
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-radius', '14');
    script.setAttribute('data-onauth', 'onTelegramAuth(user)');
    script.setAttribute('data-request-access', 'write');
    containerRef.current?.appendChild(script);

    return () => { delete window.onTelegramAuth; };
  }, [onAuth]);

  return (
    <div className="auth-tab-content">
      <div className="auth-icon-wrap tg-icon">
        <svg viewBox="0 0 24 24" fill="white" width="32" height="32">
          <path d="M12 0C5.37 0 0 5.37 0 12s5.37 12 12 12 12-5.37 12-12S18.63 0 12 0zm5.95 8.17l-2.03 9.56c-.15.67-.54.84-1.09.52l-3-2.21-1.45 1.4c-.16.16-.3.3-.61.3l.21-3.02 5.47-4.94c.24-.21-.05-.33-.36-.12L7.08 14.52l-2.96-.93c-.64-.2-.65-.64.14-.95l11.57-4.46c.53-.2 1 .13.83.99z" />
        </svg>
      </div>
      <h3 className="auth-method-title">Вход через Telegram</h3>
      <p className="auth-method-desc">
        Самый быстрый способ войти — используйте свой Telegram аккаунт
      </p>
      <div ref={containerRef} style={{ margin: '24px 0', display: 'flex', justifyContent: 'center' }} />
      {loading && <p className="auth-status">Авторизация...</p>}
      {error && <p className="auth-error">{error}</p>}
      <div className="auth-hint">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
          <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
        <span>Нажмите кнопку выше и подтвердите вход в Telegram</span>
      </div>
    </div>
  );
}

function EmailLogin() {
  const { loginEmail, registerEmail } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    if (isRegister && !name) return;

    setLoading(true);
    setError('');
    try {
      if (isRegister) {
        await registerEmail(email, password, name);
      } else {
        await loginEmail(email, password);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-tab-content">
      <div className="auth-icon-wrap email-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="28" height="28">
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <path d="M22 4l-10 8L2 4" />
        </svg>
      </div>
      <h3 className="auth-method-title">{isRegister ? 'Регистрация' : 'Вход по email'}</h3>
      <p className="auth-method-desc">
        {isRegister ? 'Создайте аккаунт с email и паролем' : 'Войдите с помощью email и пароля'}
      </p>
      <form onSubmit={handleSubmit} className="auth-form">
        {isRegister && (
          <div className="auth-field">
            <label>Ваше имя</label>
            <div className="auth-input-wrap">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Иван Петров"
                autoComplete="name"
              />
            </div>
          </div>
        )}
        <div className="auth-field">
          <label>Email</label>
          <div className="auth-input-wrap">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <path d="M22 4l-10 8L2 4" />
            </svg>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              autoComplete="email"
              required
            />
          </div>
        </div>
        <div className="auth-field">
          <label>Пароль</label>
          <div className="auth-input-wrap">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isRegister ? 'Минимум 8 символов' : 'Ваш пароль'}
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              required
            />
            <button
              type="button"
              className="auth-eye-btn"
              onClick={() => setShowPassword(!showPassword)}
              tabIndex={-1}
            >
              {showPassword ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
        </div>
        {error && <p className="auth-error">{error}</p>}
        <button type="submit" className="auth-submit-btn" disabled={loading}>
          {loading ? (
            <span className="auth-spinner" />
          ) : isRegister ? (
            'Создать аккаунт'
          ) : (
            'Войти'
          )}
        </button>
      </form>
      <button
        className="auth-switch-btn"
        onClick={() => { setIsRegister(!isRegister); setError(''); }}
      >
        {isRegister ? 'Уже есть аккаунт? Войти' : 'Нет аккаунта? Зарегистрироваться'}
      </button>
    </div>
  );
}

function PinLogin() {
  const { loginPin } = useAuth();
  const [pin, setPin] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const MAX_PIN = 6;

  const handleDigit = useCallback((digit: string) => {
    if (pin.length >= MAX_PIN) return;
    setPin(prev => [...prev, digit]);
    setError('');
  }, [pin.length]);

  const handleDelete = useCallback(() => {
    setPin(prev => prev.slice(0, -1));
    setError('');
  }, []);

  // Auto-submit when all digits entered
  useEffect(() => {
    if (pin.length === MAX_PIN) {
      const doLogin = async () => {
        setLoading(true);
        setError('');
        try {
          await loginPin(pin.join(''));
        } catch (e: unknown) {
          setError(e instanceof Error ? e.message : 'Неверный PIN');
          setShake(true);
          setTimeout(() => { setShake(false); setPin([]); }, 600);
        } finally {
          setLoading(false);
        }
      };
      doLogin();
    }
  }, [pin, loginPin]);

  return (
    <div className="auth-tab-content">
      <div className="auth-icon-wrap pin-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" width="28" height="28">
          <rect x="3" y="11" width="18" height="11" rx="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          <circle cx="12" cy="16" r="1" fill="white" />
        </svg>
      </div>
      <h3 className="auth-method-title">Вход по PIN-коду</h3>
      <p className="auth-method-desc">Введите ваш 6-значный PIN-код</p>

      <div className={`pin-dots ${shake ? 'shake' : ''}`}>
        {Array.from({ length: MAX_PIN }).map((_, i) => (
          <div
            key={i}
            className={`pin-dot ${i < pin.length ? 'filled' : ''} ${loading ? 'pulse' : ''}`}
          />
        ))}
      </div>

      {error && <p className="auth-error" style={{ marginBottom: 16 }}>{error}</p>}

      <div className="pin-keypad">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'].map((key) => (
          <button
            key={key || 'empty'}
            className={`pin-key ${key === 'del' ? 'pin-key-del' : ''} ${key === '' ? 'pin-key-empty' : ''}`}
            onClick={() => {
              if (key === 'del') handleDelete();
              else if (key !== '') handleDigit(key);
            }}
            disabled={loading || key === ''}
          >
            {key === 'del' ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="22" height="22">
                <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" />
                <line x1="18" y1="9" x2="12" y2="15" />
                <line x1="12" y1="9" x2="18" y2="15" />
              </svg>
            ) : (
              key
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

function BiometricLogin() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [supported, setSupported] = useState(true);
  const { loginEmail: _ } = useAuth(); // just to access auth context

  useEffect(() => {
    if (!window.PublicKeyCredential) {
      setSupported(false);
    }
  }, []);

  const handleBiometric = async () => {
    setLoading(true);
    setError('');
    try {
      const options = await getWebAuthnLoginOptions();
      const pk = options.publicKey as any;

      // Decode challenge
      if (typeof pk.challenge === 'string') {
        pk.challenge = base64urlDecode(pk.challenge);
      }
      if (pk.allowCredentials) {
        pk.allowCredentials = pk.allowCredentials.map((cred: any) => ({
          ...cred,
          id: typeof cred.id === 'string' ? base64urlDecode(cred.id) : cred.id,
        }));
      }

      const credential = await navigator.credentials.get({ publicKey: pk }) as PublicKeyCredential;
      const response = credential.response as AuthenticatorAssertionResponse;

      const result = await completeWebAuthnLogin({
        id: credential.id,
        rawId: base64urlEncode(credential.rawId),
        type: credential.type,
        response: {
          clientDataJSON: base64urlEncode(response.clientDataJSON),
          authenticatorData: base64urlEncode(response.authenticatorData),
          signature: base64urlEncode(response.signature),
          userHandle: response.userHandle ? base64urlEncode(response.userHandle) : null,
        },
      });

      setTokens(result.access_token, result.refresh_token);
      window.location.reload();
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === 'NotAllowedError') {
        setError('Аутентификация отменена');
      } else {
        setError(e instanceof Error ? e.message : 'Ошибка биометрии');
      }
    } finally {
      setLoading(false);
    }
  };

  if (!supported) {
    return (
      <div className="auth-tab-content">
        <div className="auth-icon-wrap bio-icon" style={{ opacity: 0.5 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" width="32" height="32">
            <path d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 0 0 8 11a4 4 0 1 1 8 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0 0 15.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 0 0 8.08 3.488M3 3l18 18" />
          </svg>
        </div>
        <h3 className="auth-method-title">Биометрия недоступна</h3>
        <p className="auth-method-desc">
          Ваше устройство или браузер не поддерживает WebAuthn. Используйте другой метод входа.
        </p>
      </div>
    );
  }

  return (
    <div className="auth-tab-content">
      <div className="auth-icon-wrap bio-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" width="32" height="32">
          <path d="M12 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />
          <path d="M12 4a8 8 0 0 0-8 8c0 1.892.326 3.73.962 5.452" />
          <path d="M12 4a8 8 0 0 1 8 8c0 1.892-.326 3.73-.962 5.452" />
          <path d="M12 7a5 5 0 0 0-5 5c0 1.22.198 2.41.582 3.524" />
          <path d="M12 7a5 5 0 0 1 5 5c0 1.22-.198 2.41-.582 3.524" />
          <path d="M12 16v4" />
        </svg>
      </div>
      <h3 className="auth-method-title">Face ID / Touch ID</h3>
      <p className="auth-method-desc">
        Войдите с помощью биометрии вашего устройства — быстро и безопасно
      </p>

      <button
        className="auth-biometric-btn"
        onClick={handleBiometric}
        disabled={loading}
      >
        {loading ? (
          <span className="auth-spinner" />
        ) : (
          <>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24">
              <path d="M12 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />
              <path d="M12 4a8 8 0 0 0-8 8c0 1.892.326 3.73.962 5.452" />
              <path d="M12 4a8 8 0 0 1 8 8c0 1.892-.326 3.73-.962 5.452" />
              <path d="M12 7a5 5 0 0 0-5 5c0 1.22.198 2.41.582 3.524" />
              <path d="M12 7a5 5 0 0 1 5 5c0 1.22-.198 2.41-.582 3.524" />
              <path d="M12 16v4" />
            </svg>
            <span>Авторизоваться</span>
          </>
        )}
      </button>

      {error && <p className="auth-error">{error}</p>}

      <div className="auth-hint">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
        <span>Биометрические данные не покидают ваше устройство</span>
      </div>
    </div>
  );
}

/* ─── Main Login Page ─────────────────────────────────── */

export default function LoginPage() {
  const [activeTab, setActiveTab] = useState<AuthTab>('telegram');
  const { loginTelegram } = useAuth();

  const tabs: { id: AuthTab; label: string; icon: JSX.Element }[] = [
    {
      id: 'telegram',
      label: 'Telegram',
      icon: (
        <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
          <path d="M12 0C5.37 0 0 5.37 0 12s5.37 12 12 12 12-5.37 12-12S18.63 0 12 0zm5.95 8.17l-2.03 9.56c-.15.67-.54.84-1.09.52l-3-2.21-1.45 1.4c-.16.16-.3.3-.61.3l.21-3.02 5.47-4.94c.24-.21-.05-.33-.36-.12L7.08 14.52l-2.96-.93c-.64-.2-.65-.64.14-.95l11.57-4.46c.53-.2 1 .13.83.99z" />
        </svg>
      ),
    },
    {
      id: 'email',
      label: 'Email',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <path d="M22 4l-10 8L2 4" />
        </svg>
      ),
    },
    {
      id: 'pin',
      label: 'PIN',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
          <rect x="3" y="11" width="18" height="11" rx="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      ),
    },
    {
      id: 'biometric',
      label: 'Bio',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="18" height="18">
          <path d="M12 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />
          <path d="M12 4a8 8 0 0 0-8 8" />
          <path d="M12 4a8 8 0 0 1 8 8" />
          <path d="M12 7a5 5 0 0 0-5 5" />
          <path d="M12 7a5 5 0 0 1 5 5" />
        </svg>
      ),
    },
  ];

  return (
    <div className="login-page">
      <div className="login-bg">
        <div className="login-bg-orb login-bg-orb-1" />
        <div className="login-bg-orb login-bg-orb-2" />
        <div className="login-bg-orb login-bg-orb-3" />
      </div>

      <div className="login-container">
        {/* Logo & Brand */}
        <div className="login-brand">
          <div className="login-logo">
            <svg viewBox="0 0 512 512" width="56" height="56">
              <defs>
                <linearGradient id="loginGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#3B82F6" />
                  <stop offset="100%" stopColor="#1D4ED8" />
                </linearGradient>
              </defs>
              <rect width="512" height="512" rx="96" fill="url(#loginGrad)" />
              <text x="256" y="380" fontFamily="Inter, -apple-system, sans-serif" fontSize="360" fontWeight="900" fill="white" textAnchor="middle">V</text>
            </svg>
          </div>
          <h1 className="login-title">
            Virt<span>Card</span>Pay
          </h1>
          <p className="login-subtitle">Личный кабинет</p>
        </div>

        {/* Auth Method Tabs */}
        <div className="auth-tabs">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`auth-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Auth Content */}
        <div className="auth-content">
          {activeTab === 'telegram' && <TelegramLogin onAuth={loginTelegram} />}
          {activeTab === 'email' && <EmailLogin />}
          {activeTab === 'pin' && <PinLogin />}
          {activeTab === 'biometric' && <BiometricLogin />}
        </div>

        {/* Footer */}
        <div className="login-footer">
          <a href="/" className="login-back-link">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            <span>На главную</span>
          </a>
          <div className="login-security-badge">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <span>Защищённое соединение</span>
          </div>
        </div>
      </div>

      <style>{`
        /* ─── Login Page Shell ──────────────────── */
        .login-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          position: relative;
          overflow: hidden;
          background: var(--bg-primary);
        }

        .login-bg {
          position: fixed; inset: 0; pointer-events: none; z-index: 0;
        }
        .login-bg-orb {
          position: absolute; border-radius: 50%;
          filter: blur(80px); opacity: 0.4;
        }
        .login-bg-orb-1 {
          width: 400px; height: 400px; top: -100px; left: -100px;
          background: rgba(59,130,246,0.25);
          animation: orbFloat 12s ease-in-out infinite;
        }
        .login-bg-orb-2 {
          width: 300px; height: 300px; bottom: -50px; right: -50px;
          background: rgba(99,102,241,0.2);
          animation: orbFloat 15s ease-in-out infinite reverse;
        }
        .login-bg-orb-3 {
          width: 200px; height: 200px; top: 40%; left: 60%;
          background: rgba(6,182,212,0.15);
          animation: orbFloat 10s ease-in-out infinite 2s;
        }

        .login-container {
          width: 100%;
          max-width: 420px;
          position: relative;
          z-index: 1;
          animation: fadeSlideIn 0.5s ease;
        }

        /* ─── Brand ─────────────────────────────── */
        .login-brand {
          text-align: center;
          margin-bottom: 32px;
        }
        .login-logo {
          margin: 0 auto 16px;
          width: 56px; height: 56px;
        }
        .login-title {
          font-size: 28px;
          font-weight: 800;
          color: var(--text-primary);
          letter-spacing: -0.5px;
        }
        .login-title span {
          color: #3B82F6;
        }
        .login-subtitle {
          font-size: 15px;
          color: var(--text-secondary);
          margin-top: 4px;
        }

        /* ─── Auth Tabs ─────────────────────────── */
        .auth-tabs {
          display: flex;
          gap: 4px;
          padding: 4px;
          background: var(--bg-glass);
          border: 1px solid var(--border-glass);
          border-radius: 16px;
          margin-bottom: 24px;
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
        }
        .auth-tab {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 12px 8px;
          font-size: 13px;
          font-weight: 600;
          color: var(--text-muted);
          background: transparent;
          border: none;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.25s ease;
          white-space: nowrap;
        }
        .auth-tab:hover {
          color: var(--text-secondary);
        }
        .auth-tab.active {
          background: var(--accent-gradient);
          color: #fff;
          box-shadow: 0 4px 16px rgba(99,102,241,0.3);
        }
        .auth-tab svg {
          flex-shrink: 0;
        }

        /* ─── Auth Content ──────────────────────── */
        .auth-content {
          background: var(--bg-glass);
          border: 1px solid var(--border-glass);
          border-radius: 20px;
          padding: 32px 24px;
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          margin-bottom: 24px;
        }
        .auth-tab-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          animation: fadeSlideIn 0.3s ease;
        }

        /* ─── Auth Icon ─────────────────────────── */
        .auth-icon-wrap {
          width: 64px; height: 64px;
          border-radius: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 16px;
        }
        .tg-icon {
          background: linear-gradient(135deg, #2AABEE, #1A8CC7);
          box-shadow: 0 6px 24px rgba(42,171,238,0.3);
        }
        .email-icon {
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          box-shadow: 0 6px 24px rgba(99,102,241,0.3);
        }
        .pin-icon {
          background: linear-gradient(135deg, #f59e0b, #d97706);
          box-shadow: 0 6px 24px rgba(245,158,11,0.3);
        }
        .bio-icon {
          background: linear-gradient(135deg, #10b981, #059669);
          box-shadow: 0 6px 24px rgba(16,185,129,0.3);
        }

        .auth-method-title {
          font-size: 18px;
          font-weight: 700;
          color: var(--text-primary);
          margin-bottom: 6px;
          text-align: center;
        }
        .auth-method-desc {
          font-size: 14px;
          color: var(--text-secondary);
          text-align: center;
          line-height: 1.5;
          max-width: 300px;
          margin-bottom: 8px;
        }

        /* ─── Email Form ────────────────────────── */
        .auth-form {
          width: 100%;
          margin-top: 20px;
        }
        .auth-field {
          margin-bottom: 16px;
        }
        .auth-field label {
          display: block;
          font-size: 13px;
          font-weight: 600;
          color: var(--text-secondary);
          margin-bottom: 8px;
        }
        .auth-input-wrap {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 0 14px;
          background: var(--bg-glass);
          border: 1px solid var(--border-glass);
          border-radius: 12px;
          transition: all 0.2s ease;
        }
        .auth-input-wrap:focus-within {
          border-color: var(--accent-1);
          box-shadow: 0 0 0 3px rgba(99,102,241,0.1);
        }
        .auth-input-wrap svg {
          flex-shrink: 0;
          color: var(--text-muted);
        }
        .auth-input-wrap input {
          flex: 1;
          padding: 14px 0;
          background: transparent;
          border: none;
          color: var(--text-primary);
          font-size: 15px;
          outline: none;
        }
        .auth-input-wrap input::placeholder {
          color: var(--text-muted);
        }
        .auth-eye-btn {
          background: none;
          border: none;
          padding: 4px;
          color: var(--text-muted);
          cursor: pointer;
          display: flex;
          align-items: center;
        }

        .auth-submit-btn {
          width: 100%;
          padding: 16px;
          border: none;
          border-radius: 14px;
          background: var(--accent-gradient);
          color: #fff;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          box-shadow: 0 4px 16px rgba(99,102,241,0.3);
          transition: all 0.25s ease;
          margin-top: 8px;
        }
        .auth-submit-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 24px rgba(99,102,241,0.4);
        }
        .auth-submit-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }

        .auth-switch-btn {
          width: 100%;
          background: none;
          border: none;
          color: var(--accent-1);
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          padding: 12px;
          margin-top: 8px;
          transition: opacity 0.2s;
        }
        .auth-switch-btn:hover { opacity: 0.8; }

        /* ─── PIN Keypad ────────────────────────── */
        .pin-dots {
          display: flex;
          gap: 14px;
          margin: 24px 0;
        }
        .pin-dot {
          width: 16px; height: 16px;
          border-radius: 50%;
          border: 2px solid var(--border-glass-active);
          background: transparent;
          transition: all 0.2s ease;
        }
        .pin-dot.filled {
          background: var(--accent-1);
          border-color: var(--accent-1);
          box-shadow: 0 0 12px rgba(99,102,241,0.3);
        }
        .pin-dot.pulse {
          animation: pinPulse 1s ease-in-out infinite;
        }

        .pin-dots.shake {
          animation: pinShake 0.5s ease;
        }
        .pin-dots.shake .pin-dot.filled {
          background: var(--danger);
          border-color: var(--danger);
          box-shadow: 0 0 12px rgba(239,68,68,0.3);
        }

        .pin-keypad {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          width: 100%;
          max-width: 280px;
          margin: 0 auto;
        }
        .pin-key {
          width: 100%;
          aspect-ratio: 1.4;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          font-weight: 600;
          color: var(--text-primary);
          background: var(--bg-glass);
          border: 1px solid var(--border-glass);
          border-radius: 14px;
          cursor: pointer;
          transition: all 0.15s ease;
          -webkit-tap-highlight-color: transparent;
        }
        .pin-key:active {
          transform: scale(0.95);
          background: var(--bg-glass-hover);
        }
        .pin-key-empty {
          background: transparent;
          border: none;
          cursor: default;
        }
        .pin-key-del {
          color: var(--text-secondary);
        }

        /* ─── Biometric Button ──────────────────── */
        .auth-biometric-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          width: 100%;
          padding: 20px;
          margin: 24px 0 16px;
          background: linear-gradient(135deg, #10b981, #059669);
          color: white;
          font-size: 16px;
          font-weight: 700;
          border: none;
          border-radius: 16px;
          cursor: pointer;
          box-shadow: 0 6px 24px rgba(16,185,129,0.3);
          transition: all 0.25s ease;
        }
        .auth-biometric-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 36px rgba(16,185,129,0.4);
        }
        .auth-biometric-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }

        /* ─── Common Elements ───────────────────── */
        .auth-status {
          font-size: 14px;
          color: var(--accent-1);
          text-align: center;
        }
        .auth-error {
          font-size: 14px;
          color: var(--danger);
          text-align: center;
          margin-top: 8px;
        }
        .auth-hint {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          color: var(--text-muted);
          margin-top: 16px;
          text-align: left;
        }
        .auth-hint svg {
          flex-shrink: 0;
        }

        .auth-spinner {
          width: 20px; height: 20px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
        }

        /* ─── Footer ───────────────────────────── */
        .login-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .login-back-link {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          font-weight: 500;
          color: var(--text-secondary);
          text-decoration: none;
          transition: color 0.2s;
        }
        .login-back-link:hover { color: var(--accent-1); }

        .login-security-badge {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: var(--text-muted);
        }

        /* ─── Keyframes ─────────────────────────── */
        @keyframes pinShake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-10px); }
          40% { transform: translateX(10px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
        }

        @keyframes pinPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        /* ─── Mobile ────────────────────────────── */
        @media (max-width: 480px) {
          .login-page { padding: 16px; }
          .auth-content { padding: 24px 16px; }
          .auth-tab span { display: none; }
          .auth-tab { padding: 12px; }
        }
      `}</style>
    </div>
  );
}
