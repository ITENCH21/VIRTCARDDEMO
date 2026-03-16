const TELEGRAM_BOT_USERNAME =
  import.meta.env.VITE_TELEGRAM_BOT_USERNAME || 'VirtCardPay_bot';

export default function LKLoginPage() {
  return (
    <div className="lk-login-page">
      <div className="lk-login-bg">
        <div className="lk-login-orb lk-login-orb-1" />
        <div className="lk-login-orb lk-login-orb-2" />
        <div className="lk-login-orb lk-login-orb-3" />
      </div>

      <div className="lk-login-container">
        {/* Logo */}
        <div className="lk-login-logo">
          <svg viewBox="0 0 512 512" width="72" height="72">
            <defs>
              <linearGradient id="lkLoginGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#3B82F6" />
                <stop offset="100%" stopColor="#1D4ED8" />
              </linearGradient>
            </defs>
            <rect width="512" height="512" rx="96" fill="url(#lkLoginGrad)" />
            <text
              x="256"
              y="380"
              fontFamily="Inter, -apple-system, sans-serif"
              fontSize="360"
              fontWeight="900"
              fill="white"
              textAnchor="middle"
            >
              V
            </text>
          </svg>
        </div>

        <h1 className="lk-login-title">
          Virt<span>Card</span>Pay
        </h1>
        <p className="lk-login-subtitle">Личный кабинет</p>

        {/* Card */}
        <div className="lk-login-card">
          <div className="lk-login-card-icon">
            <svg viewBox="0 0 24 24" fill="currentColor" width="32" height="32">
              <path d="M12 0C5.37 0 0 5.37 0 12s5.37 12 12 12 12-5.37 12-12S18.63 0 12 0zm5.95 8.17l-2.03 9.56c-.15.67-.54.84-1.09.52l-3-2.21-1.45 1.4c-.16.16-.3.3-.61.3l.21-3.02 5.47-4.94c.24-.21-.05-.33-.36-.12L7.08 14.52l-2.96-.93c-.64-.2-.65-.64.14-.95l11.57-4.46c.53-.2 1 .13.83.99z" />
            </svg>
          </div>

          <h2 className="lk-login-card-title">
            Для входа в Личный кабинет запросите ссылку в нашем Telegram-боте
          </h2>

          <a
            href={`https://t.me/${TELEGRAM_BOT_USERNAME}`}
            className="lk-login-bot-btn"
            target="_blank"
            rel="noopener noreferrer"
          >
            <svg viewBox="0 0 24 24" fill="white" width="22" height="22">
              <path d="M12 0C5.37 0 0 5.37 0 12s5.37 12 12 12 12-5.37 12-12S18.63 0 12 0zm5.95 8.17l-2.03 9.56c-.15.67-.54.84-1.09.52l-3-2.21-1.45 1.4c-.16.16-.3.3-.61.3l.21-3.02 5.47-4.94c.24-.21-.05-.33-.36-.12L7.08 14.52l-2.96-.93c-.64-.2-.65-.64.14-.95l11.57-4.46c.53-.2 1 .13.83.99z" />
            </svg>
            Открыть бот
          </a>

          <p className="lk-login-hint">
            Или нажмите <strong>&laquo;Войти в ЛК&raquo;</strong> в меню бота
          </p>
        </div>

        {/* Footer */}
        <div className="lk-login-footer">
          <a href="/" className="lk-login-back">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              width="16"
              height="16"
            >
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            На главную
          </a>
          <div className="lk-login-secure">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              width="14"
              height="14"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            Защищённое соединение
          </div>
        </div>
      </div>

      <style>{`
        .lk-login-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          position: relative;
          overflow: hidden;
          background: var(--bg-primary);
        }

        .lk-login-bg {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 0;
        }
        .lk-login-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          opacity: 0.4;
        }
        .lk-login-orb-1 {
          width: 500px;
          height: 500px;
          top: -150px;
          left: -150px;
          background: rgba(59,130,246,0.25);
          animation: orbFloat 12s ease-in-out infinite;
        }
        .lk-login-orb-2 {
          width: 400px;
          height: 400px;
          bottom: -100px;
          right: -100px;
          background: rgba(99,102,241,0.2);
          animation: orbFloat 15s ease-in-out infinite reverse;
        }
        .lk-login-orb-3 {
          width: 250px;
          height: 250px;
          top: 40%;
          left: 60%;
          background: rgba(6,182,212,0.15);
          animation: orbFloat 10s ease-in-out infinite 2s;
        }

        .lk-login-container {
          width: 100%;
          max-width: 480px;
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          animation: fadeSlideIn 0.5s ease;
        }

        .lk-login-logo {
          margin-bottom: 20px;
        }

        .lk-login-title {
          font-size: 32px;
          font-weight: 800;
          color: var(--text-primary);
          letter-spacing: -0.5px;
          margin-bottom: 4px;
        }
        .lk-login-title span {
          color: #3B82F6;
        }

        .lk-login-subtitle {
          font-size: 16px;
          color: var(--text-secondary);
          margin-bottom: 40px;
        }

        /* Card */
        .lk-login-card {
          width: 100%;
          background: var(--bg-glass);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid var(--border-glass);
          border-radius: 24px;
          padding: 40px 32px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 20px;
          margin-bottom: 32px;
        }

        .lk-login-card-icon {
          width: 72px;
          height: 72px;
          border-radius: 20px;
          background: linear-gradient(135deg, #2AABEE, #1A8CC7);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          box-shadow: 0 8px 28px rgba(42,171,238,0.3);
        }

        .lk-login-card-title {
          font-size: 17px;
          font-weight: 600;
          color: var(--text-primary);
          line-height: 1.5;
          max-width: 340px;
        }

        .lk-login-bot-btn {
          display: inline-flex;
          align-items: center;
          gap: 12px;
          padding: 18px 36px;
          font-size: 17px;
          font-weight: 800;
          color: white;
          background: linear-gradient(135deg, #2AABEE, #1A8CC7);
          border-radius: 16px;
          text-decoration: none;
          box-shadow: 0 6px 24px rgba(42,171,238,0.4);
          transition: all 0.25s ease;
        }
        .lk-login-bot-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 36px rgba(42,171,238,0.55);
        }

        .lk-login-hint {
          font-size: 14px;
          color: var(--text-muted);
          line-height: 1.5;
        }
        .lk-login-hint strong {
          color: var(--text-secondary);
        }

        /* Footer */
        .lk-login-footer {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .lk-login-back {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          font-weight: 500;
          color: var(--text-secondary);
          text-decoration: none;
          transition: color 0.2s;
        }
        .lk-login-back:hover {
          color: var(--accent-1);
        }

        .lk-login-secure {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: var(--text-muted);
        }

        @media (max-width: 480px) {
          .lk-login-page {
            padding: 16px;
          }
          .lk-login-card {
            padding: 28px 20px;
          }
          .lk-login-title {
            font-size: 26px;
          }
          .lk-login-bot-btn {
            padding: 16px 28px;
            font-size: 16px;
          }
        }
      `}</style>
    </div>
  );
}
