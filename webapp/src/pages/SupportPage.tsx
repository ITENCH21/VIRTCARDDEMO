import { useNavigate } from 'react-router-dom';
import { ExternalLinkIcon } from '../components/icons';
import { useLang } from '../contexts/LangContext';

export default function SupportPage() {
  const { t } = useLang();
  const navigate = useNavigate();

  return (
    <div className="page">
      <div className="page-wide">
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>
          {t('support_subtitle')}
        </div>
      </div>

      {/* Contact cards grid */}
      <div className="support-grid" style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 16,
        marginBottom: 28,
      }}>
        {/* Telegram */}
        <div className="glass-card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 14,
              background: 'rgba(42,171,238,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <svg viewBox="0 0 24 24" fill="none" width="24" height="24">
                <path d="M21.198 2.433a2.242 2.242 0 0 0-1.022.215l-8.609 3.33c-2.068.8-4.133 1.598-5.724 2.21a405.15 405.15 0 0 1-2.849 1.09c-.42.147-.99.332-1.473.901-.728.86-.117 1.876.196 2.191.373.376.867.594 1.088.69l2.967 1.29c.164.487 1.08 3.529 1.292 4.247.126.428.35.95.752 1.207.39.249.869.247 1.164.175l.027-.008 2.168-1.276 3.032 2.36c.602.462 1.338.677 1.95.272.613-.405.775-1.142.832-1.41l2.898-14.725c.093-.474.145-1.178-.397-1.773-.465-.51-.998-.587-1.292-.586zM9.586 13.21l-.803 3.04-.947-3.803 8.337-5.163-6.587 5.926z" fill="#2AABEE"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                {t('support_telegram_title')}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)' }} />
                <span style={{ fontSize: 12, color: 'var(--success)', fontWeight: 600 }}>{t('support_online')}</span>
              </div>
            </div>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
            {t('support_telegram_desc')}
          </p>
          <a
            href="https://t.me/virtcardpay_support"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary"
            style={{
              textDecoration: 'none', textAlign: 'center',
              background: 'linear-gradient(135deg, #2AABEE, #229ED9)',
              boxShadow: '0 4px 16px rgba(42,171,238,0.3)',
            }}
          >
            {t('support_telegram_btn')}
            <ExternalLinkIcon size={16} />
          </a>
          <div style={{ fontSize: 13, color: 'var(--accent-1)', fontWeight: 600, textAlign: 'center' }}>
            @virtcardpay_support
          </div>
        </div>

        {/* Email */}
        <div className="glass-card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 14,
              background: 'rgba(59,130,246,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" width="24" height="24">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="M22 7l-10 6L2 7" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                {t('support_email_title')}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                24h response
              </div>
            </div>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
            {t('support_email_desc')}
          </p>
          <a
            href="mailto:support@virtcardpay.ru"
            className="btn btn-primary"
            style={{ textDecoration: 'none', textAlign: 'center' }}
          >
            support@virtcardpay.ru
          </a>
        </div>

        {/* FAQ */}
        <div className="glass-card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 14,
              background: 'rgba(245,158,11,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" width="24" height="24">
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                {t('support_faq_title')}
              </div>
            </div>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
            {t('support_faq_desc')}
          </p>
          <button
            className="btn btn-secondary"
            onClick={() => navigate('/faq')}
          >
            {t('support_faq_btn')}
          </button>
        </div>

        {/* Working hours */}
        <div className="glass-card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 14,
              background: 'rgba(16,185,129,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" width="24" height="24">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                {t('support_hours_title')}
              </div>
            </div>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
            {t('support_hours_desc')}
          </p>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 14px', borderRadius: 10,
            background: 'rgba(16,185,129,0.08)',
          }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success)' }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--success)' }}>24/7</span>
          </div>
        </div>
      </div>

      </div>{/* end page-wide */}

      <style>{`
        @media (max-width: 768px) {
          .support-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
