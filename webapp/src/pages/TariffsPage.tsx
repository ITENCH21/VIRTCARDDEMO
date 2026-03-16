import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLang } from '../contexts/LangContext';

const CHECK = (
  <svg viewBox="0 0 20 20" fill="none" width="16" height="16">
    <circle cx="10" cy="10" r="10" fill="rgba(16,185,129,0.15)" />
    <polyline points="5,10 8.5,13.5 15,7" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const CROSS = (
  <svg viewBox="0 0 20 20" fill="none" width="16" height="16">
    <circle cx="10" cy="10" r="10" fill="rgba(239,68,68,0.12)" />
    <line x1="7" y1="7" x2="13" y2="13" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
    <line x1="13" y1="7" x2="7" y2="13" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

interface PlanRow {
  label: string;
  value?: string;
  highlight?: boolean;
  bold?: boolean;
  bool?: boolean;
}

interface Plan {
  title: string;
  subtitle: string;
  networks: { label: string; color: string }[];
  rows: PlanRow[];
  total: string;
  popular?: boolean;
}

export default function TariffsPage() {
  const navigate = useNavigate();
  const { t, lang } = useLang();
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const PLANS: Plan[] = [
    {
      title: t('issue_standard'),
      subtitle: t('plan_standard_subtitle'),
      networks: [
        { label: 'USD · VISA', color: '#1a56db' },
        { label: 'EUR · Mastercard', color: '#e65c00' },
      ],
      rows: [
        { label: t('tr_open_cost'), value: '$6 / €6', bold: true },
        { label: t('tr_topup_fee'), value: '6%', highlight: true },
        { label: t('tr_conversion'), value: t('tr_conversion_rate'), bold: true },
        { label: t('tr_min_open'), value: '$100 / €100', bold: true },
        { label: t('tr_min_topup'), value: '$100 / €100', bold: true },
        { label: t('tr_max_topup'), value: '$25 000 / €25 000', bold: true },
        { label: t('tr_3ds'), bool: true },
        { label: t('tr_apple'), bool: false },
        { label: t('tr_google'), bool: false },
        { label: t('tr_support'), bool: true },
      ],
      total: lang === 'ru' ? 'от $112' : 'from $112',
    },
    {
      title: 'Apple / Google Pay',
      subtitle: t('plan_pay_subtitle'),
      popular: true,
      networks: [
        { label: 'USD · Mastercard', color: '#e65c00' },
        { label: 'EUR · Mastercard', color: '#e65c00' },
      ],
      rows: [
        { label: t('tr_open_cost'), value: '$15 / €15', bold: true },
        { label: t('tr_topup_fee'), value: '5%', highlight: true },
        { label: t('tr_conversion'), value: t('tr_conversion_rate'), bold: true },
        { label: t('tr_min_open'), value: '$50 / €50', bold: true },
        { label: t('tr_min_topup'), value: '$50 / €50', bold: true },
        { label: t('tr_max_topup'), value: '$25 000 / €25 000', bold: true },
        { label: t('tr_3ds'), bool: false },
        { label: t('tr_apple'), bool: true },
        { label: t('tr_google'), bool: true },
        { label: t('tr_offline'), bool: true },
        { label: t('tr_priority'), bool: true },
      ],
      total: lang === 'ru' ? 'от $67.50' : 'from $67.50',
    },
  ];

  const FAQ = lang === 'ru' ? [
    {
      q: 'Как пополнить карту?',
      a: 'Пополнение производится через USDT (TRC-20). Перейдите в раздел «Пополнить», скопируйте адрес кошелька и отправьте USDT. После подтверждения транзакции средства автоматически конвертируются и зачислятся на карту.',
    },
    {
      q: 'Сколько времени занимает зачисление?',
      a: 'Обычно 5–15 минут после подтверждения транзакции в сети TRON. Иногда до 1 часа при высокой нагрузке сети.',
    },
    {
      q: 'Где можно использовать карту?',
      a: 'Карту Стандарт принимают все онлайн-магазины, поддерживающие VISA/Mastercard. Карта Apple/Google Pay дополнительно работает в офлайн-магазинах через бесконтактную оплату.',
    },
    {
      q: 'Можно ли вывести остаток при закрытии карты?',
      a: 'Да. При закрытии карты остаток средств автоматически возвращается на ваш основной счёт USDT в течение 1–3 рабочих дней.',
    },
    {
      q: 'Безопасно ли хранить деньги на карте?',
      a: 'Карта предназначена для онлайн-платежей, не для хранения крупных сумм. Рекомендуем держать на ней только необходимый для покупок баланс.',
    },
    {
      q: 'Как заблокировать карту если она потеряна?',
      a: 'Мгновенно заблокируйте карту в разделе «Мои карты» → нажмите на карту → «Заблокировать». Карту можно разблокировать в любой момент.',
    },
  ] : [
    {
      q: 'How do I top up the card?',
      a: 'Top-up is done via USDT (TRC-20). Go to the "Deposit" section, copy the wallet address and send USDT. After the transaction is confirmed, funds are automatically converted and credited to the card.',
    },
    {
      q: 'How long does crediting take?',
      a: 'Usually 5–15 minutes after TRON network confirmation. Sometimes up to 1 hour during high network load.',
    },
    {
      q: 'Where can I use the card?',
      a: 'The Standard card is accepted by all online stores supporting VISA/Mastercard. The Apple/Google Pay card also works in offline stores via contactless payment.',
    },
    {
      q: 'Can I withdraw the balance when closing the card?',
      a: 'Yes. When closing the card, the remaining balance is automatically returned to your main USDT account within 1–3 business days.',
    },
    {
      q: 'Is it safe to keep money on the card?',
      a: 'The card is designed for online payments, not for storing large amounts. We recommend keeping only the balance needed for purchases.',
    },
    {
      q: 'How to block the card if it is lost?',
      a: 'Instantly block the card in "My Cards" → tap on the card → "Block card". You can unblock it at any time.',
    },
  ];

  return (
    <div className="page">

      {/* Subtitle */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('tariffs_subtitle')}</div>
      </div>

      {/* Plan cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginBottom: 32 }}>
        {PLANS.map((plan) => (
          <div
            key={plan.title}
            className="glass-card"
            style={{
              padding: 0, overflow: 'hidden',
              border: plan.popular
                ? '1.5px solid rgba(99,102,241,0.45)'
                : '1px solid var(--border-glass)',
              boxShadow: plan.popular ? '0 8px 32px rgba(99,102,241,0.15)' : undefined,
            }}
          >
            {/* Header */}
            <div style={{ padding: '18px 20px 14px', position: 'relative' }}>
              {plan.popular && (
                <div style={{
                  position: 'absolute', top: 0, right: 20,
                  background: 'var(--accent-gradient)',
                  color: '#fff', fontSize: 10, fontWeight: 700,
                  padding: '3px 10px', borderRadius: '0 0 8px 8px',
                  letterSpacing: 0.5, textTransform: 'uppercase',
                }}>
                  {t('tariffs_popular')}
                </div>
              )}
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>
                {plan.title}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 14 }}>
                {plan.subtitle}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {plan.networks.map((n) => (
                  <span key={n.label} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '4px 10px', borderRadius: 20,
                    background: 'var(--bg-glass)', border: '1px solid var(--border-glass)',
                    fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)',
                  }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: n.color, display: 'inline-block', flexShrink: 0 }} />
                    {n.label}
                  </span>
                ))}
              </div>
            </div>

            {/* Rows */}
            <div style={{ borderTop: '1px solid var(--border-glass)' }}>
              {plan.rows.map((row, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '11px 20px',
                  borderBottom: i < plan.rows.length - 1 ? '1px solid var(--border-glass)' : 'none',
                }}>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{row.label}</span>
                  {row.bool !== undefined ? (
                    <span>{row.bool ? CHECK : CROSS}</span>
                  ) : (
                    <span style={{
                      fontSize: 13, fontWeight: row.bold ? 700 : 500,
                      color: row.highlight ? '#ef4444' : 'var(--text-primary)',
                    }}>
                      {row.value}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Total + button */}
            <div style={{ padding: '14px 20px 18px', borderTop: '1px solid var(--border-glass)' }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 14px', borderRadius: 10,
                background: 'var(--bg-glass)', border: '1px solid var(--border-glass)',
                marginBottom: 12,
              }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{t('tariffs_total_label')}:</span>
                <span style={{ fontSize: 15, fontWeight: 800, color: '#6366f1' }}>{plan.total}</span>
              </div>
              <button
                onClick={() => navigate('/cards/issue')}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  width: '100%', padding: '13px 0', borderRadius: 12,
                  background: plan.popular
                    ? 'linear-gradient(135deg, #2563eb, #4f46e5)'
                    : 'var(--bg-glass)',
                  color: plan.popular ? '#fff' : 'var(--text-primary)',
                  fontSize: 14, fontWeight: 700,
                  border: plan.popular ? 'none' : '1px solid var(--border-glass)',
                  cursor: 'pointer',
                  boxShadow: plan.popular ? '0 4px 16px rgba(79,70,229,0.35)' : 'none',
                }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                  <rect x="1" y="4" width="22" height="16" rx="2" />
                  <line x1="1" y1="10" x2="23" y2="10" />
                </svg>
                {t('tariffs_open_card')}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* FAQ */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>
          {t('tariffs_faq_title')}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
          {t('tariffs_faq_subtitle')}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {FAQ.map((item, i) => (
            <div
              key={i}
              className="glass-card"
              style={{ padding: 0, overflow: 'hidden', cursor: 'pointer' }}
              onClick={() => setOpenFaq(openFaq === i ? null : i)}
            >
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 18px', gap: 12,
              }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.4 }}>
                  {item.q}
                </span>
                <svg
                  viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"
                  width="18" height="18" style={{
                    flexShrink: 0,
                    transform: openFaq === i ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s ease',
                  }}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>

              {openFaq === i && (
                <div style={{
                  padding: '0 18px 16px',
                  borderTop: '1px solid var(--border-glass)',
                  paddingTop: 14,
                }}>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>
                    {item.a}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Footnote */}
      <div style={{
        marginTop: 20, padding: '12px 16px', borderRadius: 'var(--radius-md)',
        background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)',
        borderLeft: '3px solid #3b82f6',
      }}>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
          {t('tariffs_footnote')}
        </p>
      </div>
    </div>
  );
}
