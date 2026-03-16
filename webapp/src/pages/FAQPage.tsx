import { useState, useMemo, useEffect } from 'react';
import { useLang } from '../contexts/LangContext';

interface FaqItem {
  q: string;
  a: string;
  category: string;
}

const FAQ_RU: FaqItem[] = [
  // Регистрация и аккаунт
  { category: 'Аккаунт', q: 'Как зарегистрироваться в VirtCardPay?', a: 'Откройте бота @VirtCardPayBot в Telegram и нажмите Start. Регистрация происходит автоматически через ваш Telegram-аккаунт — никаких паролей и форм заполнять не нужно.' },
  { category: 'Аккаунт', q: 'Какие документы нужны для регистрации?', a: 'Никаких документов не требуется. Мы используем Telegram-аутентификацию. В некоторых случаях для увеличения лимитов может потребоваться верификация.' },
  { category: 'Аккаунт', q: 'Могу ли я использовать один аккаунт с нескольких устройств?', a: 'Да. Личный кабинет доступен через Telegram Mini App на любом устройстве, где установлен ваш Telegram.' },
  { category: 'Аккаунт', q: 'Как выйти из аккаунта?', a: 'В разделе «Профиль» нажмите кнопку «Выйти». Ваши данные и карты сохраняются — при следующем входе через Telegram всё будет на месте.' },

  // Пополнение
  { category: 'Пополнение', q: 'Как пополнить баланс?', a: 'Перейдите в раздел «Пополнить» → скопируйте USDT TRC-20 адрес или отсканируйте QR-код → отправьте USDT на этот адрес. После подтверждения в сети TRON средства конвертируются и зачислятся автоматически.' },
  { category: 'Пополнение', q: 'Сколько времени занимает зачисление?', a: 'Обычно 5–15 минут после подтверждения транзакции в сети TRON. В редких случаях при высокой нагрузке сети — до 1 часа.' },
  { category: 'Пополнение', q: 'Какие криптовалюты принимаются?', a: 'Только USDT в сети TRON (TRC-20). Отправка других токенов или через другие сети (ERC-20, BEP-20 и др.) приведёт к безвозвратной потере средств.' },
  { category: 'Пополнение', q: 'Есть ли минимальная сумма пополнения?', a: 'Минимальная сумма зависит от типа карты: Стандарт — от $100 / €100, Apple/Google Pay — от $50 / €50.' },
  { category: 'Пополнение', q: 'Почему адрес для пополнения один и тот же?', a: 'Каждому пользователю выдаётся постоянный персональный USDT-адрес. Вы можете пополнять его многократно — все поступления зачисляются на ваш счёт.' },

  // Карты — Стандарт
  { category: 'Карта Стандарт', q: 'Что такое карта Стандарт?', a: 'Виртуальная карта VISA/Mastercard в USD или EUR для оплаты онлайн-сервисов: Google Ads, Facebook Ads, домены, хостинг, подписки (Netflix, Spotify, ChatGPT и т.д.) и игры.' },
  { category: 'Карта Стандарт', q: 'Для чего подходит USD-карта?', a: 'USD-карта работает по вайт-листу: Google Ads, Facebook/Meta Ads, TikTok Ads, Twitter Ads, домены, хостинг, облачные сервисы, подписки, игры. Использование в офлайн-магазинах и такси не поддерживается.' },
  { category: 'Карта Стандарт', q: 'Для чего подходит EUR-карта?', a: 'EUR-карта работает без ограничений — онлайн и офлайн: интернет-магазины с физическими товарами, такси, рестораны, подписки и всё остальное.' },
  { category: 'Карта Стандарт', q: 'Сколько стоит открыть карту Стандарт?', a: 'Стоимость открытия — $6 / €6. Комиссия за пополнение через USDT — 6%. Конвертация USDT→USD/EUR по курсу биржи +1%.' },
  { category: 'Карта Стандарт', q: 'Каков минимальный баланс для выпуска карты?', a: 'Минимальный баланс на счёте для выпуска карты Стандарт — $100 / €100.' },

  // Карты — Apple/Google Pay
  { category: 'Apple/Google Pay', q: 'Что такое карта Apple / Google Pay?', a: 'Виртуальная Mastercard с поддержкой бесконтактных платежей: Apple Pay, Google Pay, оплата в офлайн-магазинах, такси (Uber, Bolt, Glovo), рестораны (McDonald\'s, Tim Hortons) и многое другое.' },
  { category: 'Apple/Google Pay', q: 'Как добавить карту в Apple Pay?', a: 'После выпуска карты перейдите в настройки iPhone → Wallet & Apple Pay → добавьте карту, введите данные из раздела «Реквизиты» в приложении. Обычно активируется мгновенно.' },
  { category: 'Apple/Google Pay', q: 'Как добавить карту в Google Pay?', a: 'Откройте Google Wallet → «Добавить карту» → «Карта» → введите данные карты из раздела «Реквизиты». Следуйте инструкции на экране.' },
  { category: 'Apple/Google Pay', q: 'Сколько стоит открыть карту Apple/Google Pay?', a: 'Стоимость открытия — $15 / €15. Комиссия за пополнение USDT — 5%. Конвертация по курсу биржи +1%. Минимальный баланс для выпуска — $50 / €50.' },
  { category: 'Apple/Google Pay', q: 'Поддерживает ли карта 3D Secure?', a: 'Нет, карта Apple/Google Pay не поддерживает 3D Secure. Если сайт требует подтверждение по SMS/коду, используйте карту Стандарт.' },

  // Пополнение карты
  { category: 'Пополнение карты', q: 'Как пополнить карту?', a: 'Перейдите в раздел «Карты» → выберите карту → «Пополнить карту». Введите сумму и подтвердите. Средства спишутся с вашего основного USDT-счёта и мгновенно зачислятся на карту.' },
  { category: 'Пополнение карты', q: 'Есть ли минимум и максимум пополнения карты?', a: 'Минимальное пополнение: Стандарт — $100 / €100, Apple/Google Pay — $50 / €50. Максимальное пополнение — $25 000 / €25 000 за транзакцию.' },
  { category: 'Пополнение карты', q: 'Можно ли пополнить карту в другой валюте?', a: 'Нет. Пополнение осуществляется только через основной счёт в USDT, который автоматически конвертируется в валюту карты (USD или EUR).' },

  // Вывод средств
  { category: 'Вывод', q: 'Как вывести средства?', a: 'Раздел «Вывод» → введите сумму → укажите USDT TRC-20 адрес кошелька → нажмите «Рассчитать комиссию» → подтвердите. Средства поступят на ваш кошелёк в течение 10–60 минут.' },
  { category: 'Вывод', q: 'Какая комиссия за вывод?', a: 'Комиссия зависит от выбранного тарифа. Уточнить можно в разделе «Тарифы и лимиты» или непосредственно при расчёте вывода — система покажет точную сумму до подтверждения.' },
  { category: 'Вывод', q: 'Какой минимум для вывода?', a: 'Минимальная сумма вывода — 50 USDT.' },
  { category: 'Вывод', q: 'Куда можно вывести средства?', a: 'Только на USDT-кошелёк в сети TRON (TRC-20). Другие сети и криптовалюты не поддерживаются.' },

  // Безопасность карты
  { category: 'Безопасность', q: 'Как заблокировать карту?', a: 'Раздел «Карты» → выберите карту → «Заблокировать карту». Карта мгновенно перестанет принимать платежи. Разблокировать можно в любой момент там же.' },
  { category: 'Безопасность', q: 'Как закрыть карту?', a: 'Раздел «Карты» → выберите карту → «Закрыть карту». Подтвердите действие. Остаток средств автоматически вернётся на ваш основной счёт.' },
  { category: 'Безопасность', q: 'Что делать если карта была скомпрометирована?', a: 'Немедленно заблокируйте карту через приложение. Напишите в поддержку — мы поможем закрыть старую карту и выпустить новую. Средства на заблокированной карте в безопасности.' },
  { category: 'Безопасность', q: 'Безопасно ли хранить деньги на карте?', a: 'Карта предназначена для платежей, а не для хранения. Рекомендуем держать на карте только сумму, необходимую для ближайших покупок. Основной баланс хранится на USDT-счёте.' },

  // Реквизиты
  { category: 'Реквизиты', q: 'Где посмотреть номер карты, CVV и срок?', a: 'Раздел «Карты» → выберите карту → нажмите «Показать реквизиты». Данные отображаются только после подтверждения. Скопировать каждый реквизит можно иконкой рядом.' },
  { category: 'Реквизиты', q: 'Нужно ли вводить имя владельца при оплате?', a: 'Как правило, имя владельца не имеет значения для виртуальных карт. Можно вводить любое латинское имя, например "CARD HOLDER".' },
  { category: 'Реквизиты', q: 'Меняется ли CVV со временем?', a: 'Нет. CVV статичный и действителен на протяжении всего срока карты.' },

  // Сервисы
  { category: 'Сервисы', q: 'Какие сервисы поддерживаются?', a: 'Стандартная карта поддерживает 180+ сервисов из вайт-листа: Google Ads, Meta Ads, OpenAI, GitHub, Adobe, Cloudflare, Netflix, Shopify и сотни других. Карта Apple/Google Pay — 60+ сервисов с акцентом на физические магазины и бесконтактную оплату.' },
  { category: 'Сервисы', q: 'Почему платёж отклонён на разрешённом сервисе?', a: 'Убедитесь что: 1) на карте достаточно средств, 2) карта не заблокирована, 3) сервис принимает именно эту платёжную систему (VISA/Mastercard). Если всё в порядке — напишите в поддержку с деталями транзакции.' },
  { category: 'Сервисы', q: 'Можно ли использовать карту для рекуррентных платежей (подписок)?', a: 'Да. Карта поддерживает автосписания для сервисов из вайт-листа. Убедитесь, что на карте достаточно средств к дате списания.' },
  { category: 'Сервисы', q: 'Работает ли карта с PayPal?', a: 'Да, обе карты (Стандарт и Apple/Google Pay) можно привязать к PayPal-аккаунту.' },

  // Лимиты и тарифы
  { category: 'Лимиты', q: 'Какие лимиты на пополнение карты?', a: 'Максимальная сумма одного пополнения карты — $25 000 / €25 000. Ограничений по количеству пополнений нет.' },
  { category: 'Лимиты', q: 'Сколько карт можно открыть?', a: 'Количество активных карт не ограничено. Вы можете открывать как USD, так и EUR карты обоих типов.' },
  { category: 'Лимиты', q: 'Где посмотреть актуальные тарифы?', a: 'Все комиссии и условия собраны в разделе «Тарифы и лимиты» в приложении.' },

  // Поддержка
  { category: 'Поддержка', q: 'Как связаться с поддержкой?', a: 'Напишите в Telegram: @VirtCardPaySupport или через раздел «Поддержка» в приложении. Среднее время ответа — до 30 минут в рабочее время.' },
  { category: 'Поддержка', q: 'Что делать если транзакция зависла?', a: 'Дождитесь 15 минут. Если статус не изменился — нажмите кнопку «Синхронизировать» в разделе операции, или обратитесь в поддержку с ID транзакции.' },
  { category: 'Поддержка', q: 'Как оспорить списание с карты?', a: 'Обратитесь в поддержку с подробностями: дата, сумма, название магазина. Мы рассмотрим каждый случай индивидуально.' },
];

const FAQ_EN: FaqItem[] = [
  // Account
  { category: 'Account', q: 'How do I register with VirtCardPay?', a: 'Open the @VirtCardPayBot in Telegram and press Start. Registration happens automatically via your Telegram account — no passwords or forms required.' },
  { category: 'Account', q: 'What documents are needed for registration?', a: 'No documents required. We use Telegram authentication. In some cases, verification may be required to increase limits.' },
  { category: 'Account', q: 'Can I use one account from multiple devices?', a: 'Yes. Your personal account is accessible via the Telegram Mini App on any device with your Telegram installed.' },
  { category: 'Account', q: 'How do I log out?', a: 'In the "Profile" section, tap the "Log out" button. Your data and cards are saved — next time you log in via Telegram everything will be there.' },
  // Deposit
  { category: 'Deposit', q: 'How do I top up my balance?', a: 'Go to "Deposit" → copy the USDT TRC-20 address or scan the QR code → send USDT to this address. After TRON network confirmation the funds are converted and credited automatically.' },
  { category: 'Deposit', q: 'How long does crediting take?', a: 'Usually 5–15 minutes after TRON network confirmation. In rare cases during high network load — up to 1 hour.' },
  { category: 'Deposit', q: 'Which cryptocurrencies are accepted?', a: 'Only USDT on the TRON network (TRC-20). Sending other tokens or via other networks (ERC-20, BEP-20, etc.) will result in permanent loss of funds.' },
  { category: 'Deposit', q: 'Is there a minimum deposit amount?', a: 'Minimum amount depends on the card type: Standard — from $100 / €100, Apple/Google Pay — from $50 / €50.' },
  { category: 'Deposit', q: 'Why is the deposit address always the same?', a: 'Each user gets a permanent personal USDT address. You can top it up multiple times — all incoming funds are credited to your account.' },
  // Standard Card
  { category: 'Standard Card', q: 'What is the Standard card?', a: 'A virtual VISA/Mastercard in USD or EUR for online payments: Google Ads, Facebook Ads, domains, hosting, subscriptions (Netflix, Spotify, ChatGPT, etc.) and games.' },
  { category: 'Standard Card', q: 'What is the USD card suitable for?', a: 'The USD card works via whitelist: Google Ads, Facebook/Meta Ads, TikTok Ads, Twitter Ads, domains, hosting, cloud services, subscriptions, games. Offline stores and taxi are not supported.' },
  { category: 'Standard Card', q: 'What is the EUR card suitable for?', a: 'The EUR card works without restrictions — online and offline: online stores with physical goods, taxi, restaurants, subscriptions and everything else.' },
  { category: 'Standard Card', q: 'How much does it cost to open a Standard card?', a: 'Opening fee — $6 / €6. USDT top-up fee — 6%. USDT→USD/EUR conversion at exchange rate +1%.' },
  { category: 'Standard Card', q: 'What is the minimum balance to issue a card?', a: 'Minimum account balance to issue a Standard card — $100 / €100.' },
  // Apple/Google Pay
  { category: 'Apple/Google Pay', q: 'What is the Apple / Google Pay card?', a: 'A virtual Mastercard with contactless payment support: Apple Pay, Google Pay, offline store payments, taxi (Uber, Bolt, Glovo), restaurants (McDonald\'s, Tim Hortons) and much more.' },
  { category: 'Apple/Google Pay', q: 'How do I add the card to Apple Pay?', a: 'After issuing the card, go to iPhone Settings → Wallet & Apple Pay → add card, enter the details from the "Card Details" section in the app. Usually activates instantly.' },
  { category: 'Apple/Google Pay', q: 'How do I add the card to Google Pay?', a: 'Open Google Wallet → "Add card" → "Card" → enter card details from the "Card Details" section. Follow the on-screen instructions.' },
  { category: 'Apple/Google Pay', q: 'How much does the Apple/Google Pay card cost?', a: 'Opening fee — $15 / €15. USDT top-up fee — 5%. Conversion at exchange rate +1%. Minimum balance to issue — $50 / €50.' },
  { category: 'Apple/Google Pay', q: 'Does the card support 3D Secure?', a: 'No, the Apple/Google Pay card does not support 3D Secure. If a site requires SMS/code confirmation, use the Standard card.' },
  // Card Top-up
  { category: 'Card Top-up', q: 'How do I top up the card?', a: 'Go to "Cards" → select a card → "Top up card". Enter the amount and confirm. Funds are deducted from your main USDT account and instantly credited to the card.' },
  { category: 'Card Top-up', q: 'Are there minimum and maximum top-up amounts?', a: 'Minimum top-up: Standard — $100 / €100, Apple/Google Pay — $50 / €50. Maximum top-up — $25,000 / €25,000 per transaction.' },
  { category: 'Card Top-up', q: 'Can I top up the card in a different currency?', a: 'No. Top-up is only done via the main USDT account, which is automatically converted to the card currency (USD or EUR).' },
  // Withdrawal
  { category: 'Withdrawal', q: 'How do I withdraw funds?', a: '"Withdraw" section → enter amount → enter USDT TRC-20 wallet address → tap "Calculate fee" → confirm. Funds arrive at your wallet within 10–60 minutes.' },
  { category: 'Withdrawal', q: 'What is the withdrawal fee?', a: 'The fee depends on the selected tariff. You can check in the "Tariffs & Limits" section or directly when calculating a withdrawal — the system shows the exact amount before confirmation.' },
  { category: 'Withdrawal', q: 'What is the minimum withdrawal amount?', a: 'Minimum withdrawal amount — 50 USDT.' },
  { category: 'Withdrawal', q: 'Where can I withdraw funds to?', a: 'Only to a USDT wallet on the TRON network (TRC-20). Other networks and cryptocurrencies are not supported.' },
  // Security
  { category: 'Security', q: 'How do I block the card?', a: '"Cards" section → select card → "Block card". The card instantly stops accepting payments. You can unblock it at any time in the same place.' },
  { category: 'Security', q: 'How do I close the card?', a: '"Cards" section → select card → "Close card". Confirm the action. The remaining balance is automatically returned to your main account.' },
  { category: 'Security', q: 'What if the card was compromised?', a: 'Immediately block the card via the app. Contact support — we will help close the old card and issue a new one. Funds on the blocked card are safe.' },
  { category: 'Security', q: 'Is it safe to keep money on the card?', a: 'The card is designed for payments, not storage. We recommend keeping only the amount needed for upcoming purchases on the card. The main balance is held in your USDT account.' },
  // Card Details
  { category: 'Card Details', q: 'Where can I see the card number, CVV and expiry?', a: '"Cards" section → select card → tap "Show details". Data is displayed only after confirmation. You can copy each detail with the icon next to it.' },
  { category: 'Card Details', q: 'Is the cardholder name required for payments?', a: 'Generally, the cardholder name does not matter for virtual cards. You can enter any Latin name, for example "CARD HOLDER".' },
  { category: 'Card Details', q: 'Does the CVV change over time?', a: 'No. The CVV is static and valid for the entire card lifetime.' },
  // Services
  { category: 'Services', q: 'Which services are supported?', a: 'The Standard card supports 180+ whitelist services: Google Ads, Meta Ads, OpenAI, GitHub, Adobe, Cloudflare, Netflix, Shopify and hundreds more. The Apple/Google Pay card — 60+ services with focus on physical stores and contactless payments.' },
  { category: 'Services', q: 'Why is a payment declined on an allowed service?', a: 'Make sure: 1) the card has sufficient funds, 2) the card is not blocked, 3) the service accepts this payment system (VISA/Mastercard). If everything is fine — contact support with transaction details.' },
  { category: 'Services', q: 'Can I use the card for recurring payments (subscriptions)?', a: 'Yes. The card supports auto-debits for whitelist services. Make sure the card has sufficient funds by the billing date.' },
  { category: 'Services', q: 'Does the card work with PayPal?', a: 'Yes, both cards (Standard and Apple/Google Pay) can be linked to a PayPal account.' },
  // Limits
  { category: 'Limits', q: 'What are the card top-up limits?', a: 'Maximum single top-up amount — $25,000 / €25,000. There are no limits on the number of top-ups.' },
  { category: 'Limits', q: 'How many cards can I open?', a: 'The number of active cards is unlimited. You can open both USD and EUR cards of both types.' },
  { category: 'Limits', q: 'Where can I see the current tariffs?', a: 'All fees and conditions are in the "Tariffs & Limits" section in the app.' },
  // Support
  { category: 'Support', q: 'How do I contact support?', a: 'Write on Telegram: @VirtCardPaySupport or via the "Support" section in the app. Average response time — up to 30 minutes during business hours.' },
  { category: 'Support', q: 'What if a transaction is stuck?', a: 'Wait 15 minutes. If the status has not changed — press the "Sync" button in the operation section, or contact support with the transaction ID.' },
  { category: 'Support', q: 'How do I dispute a card charge?', a: 'Contact support with details: date, amount, store name. We review each case individually.' },
];

export default function FAQPage() {
  const { t, lang } = useLang();
  const [query, setQuery] = useState('');
  const [openItem, setOpenItem] = useState<number | null>(null);
  const [activeCategory, setActiveCategory] = useState('');

  const FAQ = lang === 'ru' ? FAQ_RU : FAQ_EN;
  const CATEGORIES = [...new Set(FAQ.map(f => f.category))];

  // Reset open item and active category when language changes
  useEffect(() => {
    setOpenItem(null);
    setActiveCategory('');
  }, [lang]);

  const q = query.trim().toLowerCase();

  const filtered = useMemo(() => {
    let items = FAQ;
    if (activeCategory) items = items.filter(f => f.category === activeCategory);
    if (q) items = items.filter(f => f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q));
    return items;
  }, [q, activeCategory, FAQ]);

  return (
    <div className="page">

      {/* Поиск */}
      <div style={{ position: 'relative', marginBottom: 16 }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" width="16" height="16"
          style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpenItem(null); }}
          placeholder={t('faq_search_placeholder')}
          className="form-input"
          style={{ paddingLeft: 38, paddingRight: query ? 36 : 14 }}
          autoComplete="off"
        />
        {query && (
          <button onClick={() => setQuery('')} style={{
            position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', display: 'flex', alignItems: 'center',
          }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
              <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
          </button>
        )}
      </div>

      {/* Фильтр по категориям */}
      <div style={{
        display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4,
        marginBottom: 20, scrollbarWidth: 'none',
      }}>
        {['', ...CATEGORIES].map(cat => (
          <button key={cat} onClick={() => { setActiveCategory(cat); setOpenItem(null); }} style={{
            flexShrink: 0, padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
            cursor: 'pointer', whiteSpace: 'nowrap', transition: 'var(--transition-fast)',
            background: activeCategory === cat ? 'var(--accent-gradient)' : 'var(--bg-glass)',
            border: activeCategory === cat ? '1px solid transparent' : '1px solid var(--border-glass)',
            color: activeCategory === cat ? '#fff' : 'var(--text-secondary)',
          }}>
            {cat || t('faq_all')}
          </button>
        ))}
      </div>

      {/* Счётчик */}
      {(q || activeCategory) && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
          {lang === 'ru'
            ? `Найдено: ${filtered.length} ${filtered.length === 1 ? 'вопрос' : filtered.length < 5 ? 'вопроса' : 'вопросов'}`
            : `Found: ${filtered.length} result${filtered.length === 1 ? '' : 's'}`}
        </div>
      )}

      {/* Аккордеон */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: 14 }}>
          {t('faq_no_results')}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map((item, i) => {
            const globalIdx = FAQ.indexOf(item);
            const isOpen = openItem === globalIdx;
            return (
              <div
                key={globalIdx}
                className="glass-card"
                style={{ padding: 0, overflow: 'hidden', cursor: 'pointer' }}
                onClick={() => setOpenItem(isOpen ? null : globalIdx)}
              >
                <div style={{
                  display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
                  padding: '13px 16px', gap: 10,
                }}>
                  <div style={{ flex: 1 }}>
                    {!activeCategory && (
                      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--accent-1)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>
                        {item.category}
                      </div>
                    )}
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.4 }}>
                      {q ? (
                        item.q.split(new RegExp(`(${query.trim()})`, 'gi')).map((part, pi) =>
                          part.toLowerCase() === q
                            ? <mark key={pi} style={{ background: 'rgba(99,102,241,0.25)', color: 'var(--text-primary)', borderRadius: 2 }}>{part}</mark>
                            : part
                        )
                      ) : item.q}
                    </span>
                  </div>
                  <svg viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"
                    width="16" height="16" style={{
                      flexShrink: 0, marginTop: 2,
                      transform: isOpen ? 'rotate(180deg)' : 'none',
                      transition: 'transform 0.2s ease',
                    }}>
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </div>

                {isOpen && (
                  <div style={{
                    padding: '0 16px 14px',
                    borderTop: '1px solid var(--border-glass)',
                    paddingTop: 12,
                  }}>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>
                      {item.a}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Не нашёл ответ */}
      <div style={{
        marginTop: 24, padding: '14px 18px', borderRadius: 'var(--radius-md)',
        background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.2)',
        display: 'flex', alignItems: 'center', gap: 14,
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: 12, flexShrink: 0,
          background: 'rgba(99,102,241,0.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" width="20" height="20">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>
            {lang === 'ru' ? 'Не нашли ответ?' : "Didn't find an answer?"}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            {lang === 'ru' ? 'Напишите нам — ответим в течение 30 минут' : 'Write to us — we reply within 30 minutes'}
          </div>
        </div>
        <a href="https://t.me/VirtCardPaySupport" target="_blank" rel="noopener noreferrer"
          style={{
            marginLeft: 'auto', flexShrink: 0, padding: '8px 14px', borderRadius: 10,
            background: 'var(--accent-gradient)', color: '#fff',
            fontSize: 12, fontWeight: 700, textDecoration: 'none',
            boxShadow: '0 4px 12px rgba(99,102,241,0.3)',
          }}>
          {lang === 'ru' ? 'Написать' : 'Write'}
        </a>
      </div>
    </div>
  );
}
