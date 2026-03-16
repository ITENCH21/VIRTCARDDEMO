import { useState } from 'react';
import { InfoIcon } from '../components/icons';

export default function TariffsPage() {
  const [activeCardType, setActiveCardType] = useState<'standard' | 'premium' | 'business'>('standard');

  const cardTypes = [
    { id: 'standard', label: 'Standard', badge: 'Базовая' },
    { id: 'premium', label: 'Premium', badge: 'Рекомендуем' },
    { id: 'business', label: 'Business', badge: 'Для компаний' },
  ];

  // Tariff data
  const tariffs = {
    standard: {
      fees: [
        { name: 'Открытие карты', value: 'Бесплатно' },
        { name: 'Комиссия топапа', value: '0.5%' },
        { name: 'Минимальный топап', value: '10 USDT' },
        { name: 'Комиссия при переводе', value: '1%' },
      ],
      limits: [
        { name: 'Минимум топапа', value: '10 USDT', progress: 0 },
        { name: 'Максимум топапа в сутки', value: '5,000 USDT', current: '0 / 5,000 USDT', progress: 0 },
        { name: 'Месячный лимит', value: '50,000 USDT', current: '0 / 50,000 USDT', progress: 0 },
      ],
    },
    premium: {
      fees: [
        { name: 'Открытие карты', value: '2.99 USDT' },
        { name: 'Комиссия топапа', value: '0.25%' },
        { name: 'Минимальный топап', value: '5 USDT' },
        { name: 'Комиссия при переводе', value: '0.5%' },
      ],
      limits: [
        { name: 'Минимум топапа', value: '5 USDT', progress: 0 },
        { name: 'Максимум топапа в сутки', value: '10,000 USDT', current: '0 / 10,000 USDT', progress: 0 },
        { name: 'Месячный лимит', value: '100,000 USDT', current: '0 / 100,000 USDT', progress: 0 },
      ],
    },
    business: {
      fees: [
        { name: 'Открытие карты', value: 'По запросу' },
        { name: 'Комиссия топапа', value: 'От 0.1%' },
        { name: 'Минимальный топап', value: '1 USDT' },
        { name: 'Комиссия при переводе', value: 'По запросу' },
      ],
      limits: [
        { name: 'Минимум топапа', value: '1 USDT', progress: 0 },
        { name: 'Максимум топапа в сутки', value: 'Без лимита', current: '0 / Безлимит', progress: 100 },
        { name: 'Месячный лимит', value: 'Без лимита', current: '0 / Безлимит', progress: 100 },
      ],
    },
  };

  const currentTariff = tariffs[activeCardType as keyof typeof tariffs];

  const progressPercentage = (
    typeKey: 'standard' | 'premium' | 'business',
    index: number
  ): number => {
    if (index === 0) return 0;
    if (index === 1) {
      if (typeKey === 'standard') return 35;
      if (typeKey === 'premium') return 25;
    }
    if (index === 2) {
      if (typeKey === 'standard') return 40;
      if (typeKey === 'premium') return 15;
    }
    return 0;
  };

  return (
    <div className="page">
      <h1 className="page-title">Лимиты и тарифы</h1>

      {/* Card Type Tabs */}
      <div style={{
        display: 'flex', gap: 8, marginBottom: 24, overflowX: 'auto', paddingBottom: 4,
      }}>
        {cardTypes.map((card) => (
          <button
            key={card.id}
            onClick={() => setActiveCardType(card.id as 'standard' | 'premium' | 'business')}
            style={{
              padding: '10px 16px', borderRadius: 'var(--radius-md)',
              background: activeCardType === card.id ? 'var(--accent-1)' : 'var(--bg-glass)',
              border: activeCardType === card.id ? 'none' : '1px solid var(--border-glass)',
              color: activeCardType === card.id ? '#fff' : 'var(--text-primary)',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              transition: 'var(--transition-normal)',
              whiteSpace: 'nowrap',
              position: 'relative',
            }}
          >
            {card.label}
            {card.badge !== 'Базовая' && (
              <span style={{
                position: 'absolute', top: -8, right: 8,
                fontSize: 9, fontWeight: 700, padding: '2px 6px',
                background: activeCardType === card.id ? 'rgba(0,0,0,0.2)' : 'var(--warning)',
                color: activeCardType === card.id ? '#fff' : '#fff',
                borderRadius: 3, textTransform: 'uppercase',
              }}>
                {card.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Fees Section */}
      <div className="glass-card" style={{ padding: 20, marginBottom: 24 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 14 }}>
          Комиссии
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {currentTariff.fees.map((fee, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 0',
                borderBottom: idx < currentTariff.fees.length - 1 ? '1px solid var(--border-glass)' : 'none',
              }}
            >
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                {fee.name}
              </span>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-1)' }}>
                {fee.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Limits Section */}
      <div className="glass-card" style={{ padding: 20, marginBottom: 24 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>
          Лимиты
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {currentTariff.limits.map((limit, idx) => {
            const progress = progressPercentage(
              activeCardType as 'standard' | 'premium' | 'business',
              idx
            );

            return (
              <div key={idx}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  marginBottom: 6,
                }}>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>
                    {limit.name}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {limit.value}
                  </span>
                </div>

                {limit.current && (
                  <>
                    <div style={{
                      width: '100%', height: 6, borderRadius: 3,
                      background: 'var(--border-glass)', overflow: 'hidden', marginBottom: 4,
                    }}>
                      <div
                        style={{
                          height: '100%', background: progress > 80 ? 'var(--danger)' : 'var(--accent-1)',
                          width: `${progress}%`, transition: 'var(--transition-normal)',
                        }}
                      />
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {limit.current}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Card Type Benefits */}
      <div className="glass-card" style={{ padding: 20, marginBottom: 24 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 14 }}>
          Особенности
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {activeCardType === 'standard' && [
            '✓ Быстрое оформление (5 минут)',
            '✓ Базовые функции платежей',
            '✓ Поддержка основных валют',
            '✓ Стандартная безопасность',
          ].map((benefit, idx) => (
            <div key={idx} style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', gap: 8 }}>
              <span style={{ color: 'var(--success)', fontWeight: 700 }}>✓</span>
              {benefit.slice(2)}
            </div>
          ))}

          {activeCardType === 'premium' && [
            '✓ Все функции Standard',
            '✓ Приоритетная поддержка',
            '✓ Повышенные лимиты',
            '✓ Сниженная комиссия',
            '✓ Кешбэк 1% на транзакции',
          ].map((benefit, idx) => (
            <div key={idx} style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', gap: 8 }}>
              <span style={{ color: 'var(--success)', fontWeight: 700 }}>✓</span>
              {benefit.slice(2)}
            </div>
          ))}

          {activeCardType === 'business' && [
            '✓ Все функции Premium',
            '✓个人менеджер',
            '✓ Неограниченные лимиты',
            '✓ Специальные комиссии',
            '✓ API доступ',
            '✓ Кешбэк до 2%',
          ].map((benefit, idx) => (
            <div key={idx} style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', gap: 8 }}>
              <span style={{ color: 'var(--success)', fontWeight: 700 }}>✓</span>
              {benefit.slice(2)}
            </div>
          ))}
        </div>
      </div>

      {/* Comparison Table */}
      <div className="glass-card" style={{ padding: 20, marginBottom: 20, overflowX: 'auto' }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 14 }}>
          Сравнение
        </h2>

        <table style={{
          width: '100%', borderCollapse: 'collapse', fontSize: 12,
        }}>
          <thead>
            <tr>
              <th style={{
                textAlign: 'left', padding: '10px 0', borderBottom: '1px solid var(--border-glass)',
                color: 'var(--text-muted)', fontWeight: 600, fontSize: 11,
              }}>
                Параметр
              </th>
              <th style={{
                textAlign: 'center', padding: '10px 0', borderBottom: '1px solid var(--border-glass)',
                color: 'var(--text-muted)', fontWeight: 600, fontSize: 11,
              }}>
                Standard
              </th>
              <th style={{
                textAlign: 'center', padding: '10px 0', borderBottom: '1px solid var(--border-glass)',
                color: 'var(--accent-1)', fontWeight: 600, fontSize: 11,
              }}>
                Premium
              </th>
              <th style={{
                textAlign: 'center', padding: '10px 0', borderBottom: '1px solid var(--border-glass)',
                color: 'var(--text-muted)', fontWeight: 600, fontSize: 11,
              }}>
                Business
              </th>
            </tr>
          </thead>
          <tbody>
            {[
              { param: 'Карт в аккаунте', standard: '5', premium: 'Безлимит', business: 'Безлимит' },
              { param: 'Кешбэк', standard: '—', premium: '1%', business: 'До 2%' },
              { param: 'Приоритетная поддержка', standard: '—', premium: '✓', business: '✓' },
              { param: 'Personal Manager', standard: '—', premium: '—', business: '✓' },
              { param: 'API доступ', standard: '—', premium: '—', business: '✓' },
            ].map((row, idx) => (
              <tr key={idx}>
                <td style={{
                  padding: '10px 0', borderBottom: '1px solid var(--border-glass)',
                  color: 'var(--text-secondary)', fontWeight: 500,
                }}>
                  {row.param}
                </td>
                <td style={{
                  padding: '10px 0', borderBottom: '1px solid var(--border-glass)',
                  textAlign: 'center', color: 'var(--text-primary)',
                }}>
                  {row.standard}
                </td>
                <td style={{
                  padding: '10px 0', borderBottom: '1px solid var(--border-glass)',
                  textAlign: 'center', color: 'var(--accent-1)', fontWeight: 600,
                }}>
                  {row.premium}
                </td>
                <td style={{
                  padding: '10px 0', borderBottom: '1px solid var(--border-glass)',
                  textAlign: 'center', color: 'var(--text-primary)',
                }}>
                  {row.business}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Info Box */}
      <div className="glass-card" style={{
        padding: 14, display: 'flex', gap: 10,
        background: 'linear-gradient(135deg, rgba(59,130,246,0.1) 0%, rgba(99,102,241,0.05) 100%)',
        border: '1px solid rgba(59,130,246,0.2)',
      }}>
        <InfoIcon size={16} style={{ color: 'var(--accent-1)', flexShrink: 0, marginTop: 1 }} />
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          Лимиты обновляются в 00:00 по UTC. Вы можете изменить тип карты в любой момент в разделе "Мои карты".
        </div>
      </div>
    </div>
  );
}
