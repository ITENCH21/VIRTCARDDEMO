import { useState } from 'react';
import { ArrowsUpDownIcon, InfoIcon } from '../components/icons';

interface ExchangeRate {
  from: string;
  to: string;
  rate: number;
}

export default function ExchangePage() {
  const [fromCurrency, setFromCurrency] = useState('USDT');
  const [toCurrency, setToCurrency] = useState('USD');
  const [amount, setAmount] = useState('100');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currencies = [
    { code: 'USDT', name: 'USDT (TRC-20)', icon: '💵' },
    { code: 'USD', name: 'US Dollar', icon: '🇺🇸' },
    { code: 'EUR', name: 'Euro', icon: '🇪🇺' },
    { code: 'RUB', name: 'Russian Ruble', icon: '🇷🇺' },
    { code: 'CNY', name: 'Chinese Yuan', icon: '🇨🇳' },
  ];

  // Mock exchange rates
  const exchangeRates: Record<string, number> = {
    'USDT-USD': 1.0,
    'USDT-EUR': 0.92,
    'USDT-RUB': 92.5,
    'USDT-CNY': 7.24,
    'USD-USDT': 1.0,
    'USD-EUR': 0.92,
    'USD-RUB': 92.5,
    'USD-CNY': 7.24,
    'EUR-USDT': 1.09,
    'EUR-USD': 1.09,
    'EUR-RUB': 100.5,
    'EUR-CNY': 7.88,
    'RUB-USDT': 0.011,
    'RUB-USD': 0.011,
    'RUB-EUR': 0.01,
    'RUB-CNY': 0.078,
    'CNY-USDT': 0.138,
    'CNY-USD': 0.138,
    'CNY-EUR': 0.127,
    'CNY-RUB': 12.8,
  };

  const getExchangeRate = (from: string, to: string): number => {
    if (from === to) return 1;
    return exchangeRates[`${from}-${to}`] || 0;
  };

  const rate = getExchangeRate(fromCurrency, toCurrency);
  const convertedAmount = Number(amount) * rate;
  const fee = convertedAmount * 0.01; // 1% fee
  const finalAmount = convertedAmount - fee;

  const handleSwapCurrencies = () => {
    const temp = fromCurrency;
    setFromCurrency(toCurrency);
    setToCurrency(temp);
  };

  const handleExchange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      alert(`Обмен выполнен! Вы получите ${finalAmount.toFixed(2)} ${toCurrency}`);
      setAmount('');
    } catch (err) {
      setError('Ошибка при выполнении обмена');
    } finally {
      setLoading(false);
    }
  };

  const getCurrencyIcon = (code: string) => {
    return currencies.find(c => c.code === code)?.icon || '💱';
  };

  return (
    <div className="page">
      <h1 className="page-title">Обмен валют</h1>

      {/* Exchange Form */}
      <form onSubmit={handleExchange} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* From Currency */}
        <div className="glass-card" style={{ padding: 20 }}>
          <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>
            Отправить
          </label>

          <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              step="0.01"
              min="0"
              placeholder="0.00"
              className="form-input"
              style={{ flex: 1 }}
            />
            <select
              value={fromCurrency}
              onChange={(e) => setFromCurrency(e.target.value)}
              style={{
                padding: '12px 14px', borderRadius: 'var(--radius-md)',
                background: 'var(--bg-glass)', border: '1px solid var(--border-glass)',
                color: 'var(--text-primary)', fontSize: 13, fontWeight: 600,
                minWidth: 120, cursor: 'pointer',
              }}
            >
              {currencies.map(curr => (
                <option key={curr.code} value={curr.code}>
                  {curr.code}
                </option>
              ))}
            </select>
          </div>

          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Доступно: 5,000 {fromCurrency}
          </div>
        </div>

        {/* Swap Button */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <button
            type="button"
            onClick={handleSwapCurrencies}
            style={{
              width: 44, height: 44, borderRadius: '50%',
              background: 'var(--accent-1)', border: 'none',
              color: '#fff', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'var(--transition-normal)',
              transform: 'translateY(-22px)',
              boxShadow: '0 4px 12px rgba(99,102,241,0.3)',
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-22px) scale(1.1)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(-22px)'}
          >
            <ArrowsUpDownIcon size={20} />
          </button>
        </div>

        {/* To Currency */}
        <div className="glass-card" style={{ padding: 20 }}>
          <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>
            Получить
          </label>

          <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
            <div
              style={{
                flex: 1, padding: '12px 14px', borderRadius: 'var(--radius-md)',
                background: 'var(--bg-glass)', border: '1px solid var(--border-glass)',
                color: 'var(--text-primary)', fontSize: 14, fontWeight: 600,
                display: 'flex', alignItems: 'center',
              }}
            >
              {finalAmount.toFixed(2)}
            </div>
            <select
              value={toCurrency}
              onChange={(e) => setToCurrency(e.target.value)}
              style={{
                padding: '12px 14px', borderRadius: 'var(--radius-md)',
                background: 'var(--bg-glass)', border: '1px solid var(--border-glass)',
                color: 'var(--text-primary)', fontSize: 13, fontWeight: 600,
                minWidth: 120, cursor: 'pointer',
              }}
            >
              {currencies.map(curr => (
                <option key={curr.code} value={curr.code}>
                  {curr.code}
                </option>
              ))}
            </select>
          </div>

          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            После комиссии: {finalAmount.toFixed(2)} {toCurrency}
          </div>
        </div>

        {/* Rate Info */}
        <div className="glass-card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Курс обмена</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                1 {fromCurrency} = {rate.toFixed(4)} {toCurrency}
              </span>
            </div>

            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              paddingTop: 10, borderTop: '1px solid var(--border-glass)',
            }}>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Комиссия (1%)</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--warning)' }}>
                -{fee.toFixed(2)} {toCurrency}
              </span>
            </div>

            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              paddingTop: 10, borderTop: '1px solid var(--border-glass)',
            }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                К получению
              </span>
              <span style={{
                fontSize: 14, fontWeight: 700, color: 'var(--accent-1)',
              }}>
                {finalAmount.toFixed(2)} {toCurrency}
              </span>
            </div>
          </div>
        </div>

        {error && <p className="error-text">{error}</p>}

        {/* Exchange Button */}
        <button
          type="submit"
          disabled={loading || !amount || Number(amount) <= 0}
          className="btn btn-primary"
          style={{
            opacity: loading || !amount || Number(amount) <= 0 ? 0.5 : 1,
            cursor: loading || !amount || Number(amount) <= 0 ? 'default' : 'pointer',
          }}
        >
          {loading ? 'Обработка...' : `Обменять ${amount} ${fromCurrency}`}
        </button>

        {/* Info Box */}
        <div className="glass-card" style={{
          padding: 14, display: 'flex', gap: 10,
          background: 'linear-gradient(135deg, rgba(59,130,246,0.1) 0%, rgba(99,102,241,0.05) 100%)',
          border: '1px solid rgba(59,130,246,0.2)',
        }}>
          <InfoIcon size={16} style={{ color: 'var(--accent-1)', flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Курсы обновляются каждые 15 секунд. Обмен выполняется с комиссией 1% за операцию.
          </div>
        </div>
      </form>

      {/* Recent Exchanges */}
      <div style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>
          Последние обмены
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { from: '50 USDT', to: '46 EUR', date: '2026-03-15 12:45' },
            { from: '100 USD', to: '4625 RUB', date: '2026-03-14 18:20' },
            { from: '25 EUR', to: '27.25 USDT', date: '2026-03-13 09:15' },
          ].map((exchange, idx) => (
            <div
              key={idx}
              className="glass-card"
              style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                  {exchange.from} → {exchange.to}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  {exchange.date}
                </div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--success)', fontWeight: 600 }}>
                Выполнен
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
