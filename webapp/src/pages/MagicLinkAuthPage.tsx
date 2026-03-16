import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import Spinner from '../components/Spinner';

const TELEGRAM_BOT_USERNAME =
  import.meta.env.VITE_TELEGRAM_BOT_USERNAME || 'VirtCardPay_bot';

export default function MagicLinkAuthPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { loginMagicLink } = useAuth();
  const [error, setError] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setError('Ссылка недействительна или истекла');
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        await loginMagicLink(token);
        if (!cancelled) {
          navigate('/', { replace: true });
        }
      } catch {
        if (!cancelled) {
          setError('Ссылка недействительна или истекла');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams, loginMagicLink, navigate]);

  return (
    <div className="magic-link-page">
      <div className="magic-link-bg">
        <div className="magic-link-orb magic-link-orb-1" />
        <div className="magic-link-orb magic-link-orb-2" />
      </div>

      <div className="magic-link-container">
        {!error ? (
          <Spinner size={48} label="Выполняется вход..." sublabel="Подождите, пожалуйста" />
        ) : (
          <div className="magic-link-error">
            <div className="magic-link-error-icon">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                width="48"
                height="48"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </div>
            <h2 className="magic-link-error-title">{error}</h2>
            <p className="magic-link-error-desc">
              Запросите новую ссылку для входа в нашем Telegram-боте
            </p>
            <a
              href={`https://t.me/${TELEGRAM_BOT_USERNAME}`}
              className="magic-link-bot-btn"
              target="_blank"
              rel="noopener noreferrer"
            >
              <svg viewBox="0 0 24 24" fill="white" width="20" height="20">
                <path d="M12 0C5.37 0 0 5.37 0 12s5.37 12 12 12 12-5.37 12-12S18.63 0 12 0zm5.95 8.17l-2.03 9.56c-.15.67-.54.84-1.09.52l-3-2.21-1.45 1.4c-.16.16-.3.3-.61.3l.21-3.02 5.47-4.94c.24-.21-.05-.33-.36-.12L7.08 14.52l-2.96-.93c-.64-.2-.65-.64.14-.95l11.57-4.46c.53-.2 1 .13.83.99z" />
              </svg>
              Открыть бот
            </a>
          </div>
        )}
      </div>

      <style>{`
        .magic-link-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          position: relative;
          overflow: hidden;
          background: var(--bg-primary);
        }

        .magic-link-bg {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 0;
        }
        .magic-link-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          opacity: 0.4;
        }
        .magic-link-orb-1 {
          width: 400px;
          height: 400px;
          top: -100px;
          left: -100px;
          background: rgba(59,130,246,0.25);
          animation: orbFloat 12s ease-in-out infinite;
        }
        .magic-link-orb-2 {
          width: 300px;
          height: 300px;
          bottom: -50px;
          right: -50px;
          background: rgba(99,102,241,0.2);
          animation: orbFloat 15s ease-in-out infinite reverse;
        }

        .magic-link-container {
          position: relative;
          z-index: 1;
          text-align: center;
          animation: fadeSlideIn 0.5s ease;
        }

        .magic-link-error {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
        }

        .magic-link-error-icon {
          width: 80px;
          height: 80px;
          border-radius: 24px;
          background: rgba(239,68,68,0.12);
          border: 1px solid rgba(239,68,68,0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--danger);
        }

        .magic-link-error-title {
          font-size: 20px;
          font-weight: 700;
          color: var(--text-primary);
        }

        .magic-link-error-desc {
          font-size: 15px;
          color: var(--text-secondary);
          max-width: 320px;
          line-height: 1.5;
        }

        .magic-link-bot-btn {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 14px 28px;
          font-size: 15px;
          font-weight: 700;
          color: white;
          background: linear-gradient(135deg, #2AABEE, #1A8CC7);
          border-radius: 14px;
          text-decoration: none;
          box-shadow: 0 6px 24px rgba(42,171,238,0.35);
          transition: all 0.25s ease;
          margin-top: 8px;
        }
        .magic-link-bot-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 36px rgba(42,171,238,0.5);
        }
      `}</style>
    </div>
  );
}
