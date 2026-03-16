import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { fetchDeposit, DepositResponse } from '../api/deposit';
import Spinner from '../components/Spinner';
import { CopyIcon, CheckIcon } from '../components/icons';

export default function DepositPage() {
  const [data, setData] = useState<DepositResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Сеть</div>
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

      {/* QR + адрес */}
      <div className="glass-card" style={{ padding: 24, textAlign: 'center', marginBottom: 16 }}>
        {data?.address ? (
          <>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 20 }}>
              Отсканируйте QR или скопируйте адрес
            </div>

            {/* QR Code */}
            <div style={{
              display: 'inline-block', padding: 16, background: '#fff',
              borderRadius: 'var(--radius-lg)', boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
              marginBottom: 20,
            }}>
              <QRCodeSVG value={data.address} size={180} />
            </div>

            {/* Address Box */}
            <div style={{
              padding: '14px 16px',
              background: 'var(--bg-glass)', border: '1px solid var(--border-glass)',
              borderRadius: 'var(--radius-md)',
              fontFamily: "'SF Mono','Menlo','Consolas',monospace",
              fontSize: 12, wordBreak: 'break-all',
              color: 'var(--text-primary)', lineHeight: 1.6,
              textAlign: 'left',
            }}>
              {data.address}
            </div>

            {/* Copy Button */}
            <button
              className="btn btn-primary"
              onClick={handleCopy}
              style={{ marginTop: 16, display: 'inline-flex', alignItems: 'center', gap: 8 }}
            >
              {copied
                ? <><CheckIcon size={18} /> Скопировано!</>
                : <><CopyIcon size={18} /> Скопировать адрес</>
              }
            </button>
          </>
        ) : (
          <p style={{ color: 'var(--text-secondary)', padding: '20px 0', lineHeight: 1.5 }}>
            Кошелёк создаётся. Пожалуйста, попробуйте позже.
          </p>
        )}
      </div>

      {/* Предупреждение */}
      <div className="glass-card" style={{ padding: '16px 20px', borderLeft: '3px solid var(--warning)' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="var(--warning)" strokeWidth="2" width="18" height="18" style={{ flexShrink: 0, marginTop: 1 }}>
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
            Отправляйте только <strong>USDT (TRC-20)</strong> на этот адрес.
            Отправка других токенов приведёт к безвозвратной потере средств.
          </p>
        </div>
      </div>
    </div>
  );
}
