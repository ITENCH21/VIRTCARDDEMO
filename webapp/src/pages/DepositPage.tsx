import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { fetchDeposit, DepositResponse } from '../api/deposit';
import Spinner from '../components/Spinner';

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

      <div className="card text-center" style={{ padding: '24px' }}>
        <p className="text-hint mb-16">{data?.currency_code || 'USDT-TRC20'}</p>

        {data?.address ? (
          <>
            <div style={{
              display: 'inline-block',
              padding: '16px',
              background: '#fff',
              borderRadius: '12px',
            }}>
              <QRCodeSVG value={data.address} size={200} />
            </div>

            <div style={{
              marginTop: '16px',
              padding: '12px',
              background: 'var(--secondary-bg-color)',
              borderRadius: '8px',
              fontFamily: 'monospace',
              fontSize: '13px',
              wordBreak: 'break-all',
            }}>
              {data.address}
            </div>

            <button className="btn btn-primary mt-16" onClick={handleCopy}>
              {copied ? 'Copied!' : 'Copy Address'}
            </button>
          </>
        ) : (
          <p className="text-hint">
            Wallet address is being generated. Please try again later.
          </p>
        )}
      </div>

      <div className="text-hint mt-16" style={{ fontSize: '13px' }}>
        <p>Send only USDT (TRC-20) to this address. Sending other tokens may result in permanent loss.</p>
      </div>
    </div>
  );
}
