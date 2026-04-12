import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { fetchDeposit, DepositResponse } from '../api/deposit';
import Spinner from '../components/Spinner';
import { CopyIcon, CheckIcon } from '../components/icons';
import { useLang } from '../contexts/LangContext';

export default function DepositPage() {
  const [data, setData] = useState<DepositResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { t } = useLang();

  useEffect(() => {
    fetchDeposit()
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Ошибка загрузки'))
      .finally(() => setLoading(false));
  }, []);

  const handleCopy = async () => {
    if (!data?.address) return;
    try {
      await navigator.clipboard.writeText(data.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API недоступен
    }
  };

  if (loading) return <div className="page"><Spinner /></div>;
  if (error) return <div className="page"><p className="error-text">{error}</p></div>;

  return (
    <div className="page">
      <div className="page-narrow">
        {/* Сеть */}
        <div className="glass-card" style={{ padding: '14px 20px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: 'rgba(6,182,212,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="#06b6d4" strokeWidth="2" width="20" height="20">
              <circle cx="12" cy="12" r="10" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('deposit_network')}</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>TRON (TRC-20)</div>
          </div>
          <div style={{
            padding: '4px 10px', borderRadius: 20,
            background: 'rgba(6,182,212,0.12)',
            border: '1px solid rgba(6,182,212,0.25)',
            fontSize: 12, fontWeight: 700, color: '#06b6d4',
          }}>
            {data?.currency_code || 'USDT'}
          </div>
        </div>

        {/* Status card */}
        <div className="glass-card" style={{ padding: 32, textAlign: 'center', marginBottom: 16 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 16,
            background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="var(--accent-1)" strokeWidth="2" width="28" height="28">
              <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
            </svg>
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
            {t('deposit_unavailable_title')}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: 360, margin: '0 auto' }}>
            {t('deposit_unavailable_desc')}
          </div>
        </div>

        {/* Warning */}
        <div className="glass-card" style={{ padding: '16px 20px', borderLeft: '3px solid var(--warning)' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="var(--warning)" strokeWidth="2" width="18" height="18" style={{ flexShrink: 0, marginTop: 1 }}>
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
              {t('deposit_warning')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
