const TELEGRAM_BOT_USERNAME =
  import.meta.env.VITE_TELEGRAM_BOT_USERNAME || 'VirtCardPay_bot';

export default function LKLoginPage() {
  return (
    <div className="lk-login-page">
      <div className="lk-login-header">
        {/* Logo */}
        <div className="lk-login-logo">
          <img src="/logo.png" alt="VirtCardPay" width="240" height="240" />
        </div>

        <h1 className="lk-login-title">
          <span className="green">Virt</span><span className="blue">Card</span><span className="orange">Pay</span>
        </h1>
        <p className="lk-login-subtitle">Личный кабинет</p>
      </div>

      <div className="lk-login-container">
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

      <style>{`
        html, body, #root {
          height: 100%;
          background: var(--bg-primary);
        }

        .lk-login-page {
          min-height: 100vh;
          min-height: 100dvh;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 0 24px;
          background: var(--bg-primary);
          box-sizing: border-box;
          max-width: 480px;
          margin: 0 auto;
          width: 100%;
        }

        .lk-login-header {
          flex: 1;
          max-height: 55vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          width: 100%;
        }

        .lk-login-container {
          width: 100%;
          max-width: 480px;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          animation: fadeSlideIn 0.5s ease;
          flex-shrink: 0;
        }

        .lk-login-logo {
          margin-bottom: -32px;
        }
        .lk-login-logo img {
          border-radius: 24px;
          display: block;
        }

        .lk-login-title {
          font-size: 32px;
          font-weight: 800;
          color: var(--text-primary);
          letter-spacing: -0.5px;
          margin-bottom: 4px;
        }
        .lk-login-title .green {
          color: #10B981;
        }
        .lk-login-title .blue {
          color: #3B82F6;
        }
        .lk-login-title .orange {
          color: #F59E0B;
        }

        .lk-login-subtitle {
          font-size: 16px;
          color: var(--text-secondary);
          margin-bottom: 24px;
        }

        /* Card */
        .lk-login-card {
          width: 100%;
          background: var(--bg-glass);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(59,130,246,0.15);
          border-radius: 24px;
          padding: 32px 28px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.3), 0 0 48px rgba(59,130,246,0.08), inset 0 1px 0 rgba(255,255,255,0.05);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 20px;
          margin-bottom: 16px;
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
          padding: 12px 0;
          border-top: 1px solid rgba(255,255,255,0.06);
          box-sizing: border-box;
          flex-shrink: 0;
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
            padding: 0 16px;
          }
          .lk-login-logo img {
            width: 180px;
            height: 180px;
          }
          .lk-login-logo {
            margin-bottom: -28px;
          }
          .lk-login-title {
            font-size: 24px;
            margin-bottom: 2px;
          }
          .lk-login-subtitle {
            font-size: 13px;
            margin-bottom: 0;
          }
          .lk-login-container {
            padding-bottom: 0;
          }
          .lk-login-card {
            padding: 16px;
            gap: 10px;
            border-radius: 20px;
            margin-bottom: 0;
          }
          .lk-login-card-icon {
            width: 48px;
            height: 48px;
            border-radius: 14px;
          }
          .lk-login-card-icon svg {
            width: 24px;
            height: 26px;
          }
          .lk-login-card-title {
            font-size: 15px;
          }
          .lk-login-bot-btn {
            padding: 14px 28px;
            font-size: 15px;
            border-radius: 14px;
          }
          .lk-login-hint {
            font-size: 12px;
          }
          .lk-login-footer {
            padding-top: 4px;
          }
        }
      `}</style>
    </div>
  );
}
