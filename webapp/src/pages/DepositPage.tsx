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
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  const handleCopy = async () => {
    if (!data?.address) return;
    try {
      await navigator.clipboard.writeText(data.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API not available
    }
  };

  if (loading) return <div className="page"><Spinner /></div>;
  if (error) return <div className="page"><p className="error-text">{error}</p></div>;

  return (
    <div className="page">
      <h1 className="page-title">Deposit</h1>

      <div className="glass-card" style={{ padding: 24, textAlign: 'center' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: 'var(--bg-glass)', border: '1px solid var(--border-glass)',
          borderRadius: 20, padding: '6px 14px', marginBottom: 20,
        }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
            {data?.currency_code || 'USDT-TRC20'}
          </span>
        </div>

        {data?.address ? (
          <>
            {/* QR Code */}
            <div style={{
              display: 'inline-block', padding: 16, background: '#fff',
              borderRadius: 'var(--radius-lg)', boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
            }}>
              <QRCodeSVG value={data.address} size={200} />
            </div>

            {/* Address Box */}
            <div style={{
              marginTop: 20, padding: '14px 16px',
              background: 'var(--bg-glass)', border: '1px solid var(--border-glass)',
              borderRadius: 'var(--radius-md)',
              fontFamily: "'SF Mono','Menlo',monospace",
              fontSize: 13, wordBreak: 'break-all',
              color: 'var(--text-primary)', lineHeight: 1.5,
            }}>
              {data.address}
            </div>

            {/* Copy Button */}
            <button
              className="btn btn-primary"
              onClick={handleCopy}
              style={{ marginTop: 16, display: 'inline-flex', alignItems: 'center', gap: 8 }}
            >
              {copied ? <><CheckIcon size={18} /> Copied!</> : <><CopyIcon size={18} /> Copy Address</>}
            </button>
          </>
        ) : (
          <p style={{ color: 'var(--text-secondary)', padding: '20px 0' }}>
            Wallet address is being generated. Please try again later.
          </p>
        )}
      </div>

      {/* Network Info */}
      <div className="glass-card" style={{ padding: '16px 20px', marginTop: 16 }}>
        <div className="info-row">
          <span style={{ color: 'var(--text-muted)' }}>Network</span>
          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>TRON (TRC-20)</span>
        </div>
        <div className="info-row">
          <span style={{ color: 'var(--text-muted)' }}>Token</span>
          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>USDT</span>
        </div>
      </div>

      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 16, lineHeight: 1.5, textAlign: 'center' }}>
        Send only USDT (TRC-20) to this address. Sending other tokens may result in permanent loss.
      </p>
    </div>
  );
}
