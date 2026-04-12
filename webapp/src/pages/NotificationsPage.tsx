import { useState } from 'react';
import { BellIcon, CheckIcon, LockIcon, TrendingUpIcon, BotIcon } from '../components/icons';

export default function NotificationsPage() {
  const [toggles, setToggles] = useState({
    transactions: true,
    security: true,
    promotions: false,
    system: true,
  });

  const [notifications, setNotifications] = useState([
    {
      id: 1,
      type: 'transaction',
      title: 'Топап карты успешен',
      description: 'На карту *4242 зачислено 100 USDT',
      timestamp: '2026-03-15 14:32',
      read: false,
      icon: 'trend',
    },
    {
      id: 2,
      type: 'security',
      title: 'Новая попытка входа',
      description: 'Вход с iPhone в Москве',
      timestamp: '2026-03-15 10:15',
      read: false,
      icon: 'lock',
    },
    {
      id: 3,
      type: 'transaction',
      title: 'Вывод средств обработан',
      description: '250 USDT выведено на кошелек',
      timestamp: '2026-03-14 22:48',
      read: true,
      icon: 'trend',
    },
    {
      id: 4,
      type: 'system',
      title: 'Обновление приложения',
      description: 'Доступна новая версия VirtCardPay',
      timestamp: '2026-03-14 18:20',
      read: true,
      icon: 'bot',
    },
    {
      id: 5,
      type: 'promotions',
      title: '🎁 Специальное предложение',
      description: 'Кешбэк до 5% на топапы карт',
      timestamp: '2026-03-13 09:00',
      read: true,
      icon: 'trend',
    },
    {
      id: 6,
      type: 'transaction',
      title: 'Депозит получен',
      description: '500 USDT получено на счет',
      timestamp: '2026-03-12 16:45',
      read: true,
      icon: 'trend',
    },
  ]);

  const handleToggle = (key: keyof typeof toggles) => {
    setToggles(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleMarkAsRead = (id: number) => {
    setNotifications(prev =>
      prev.map(notif => notif.id === id ? { ...notif, read: true } : notif)
    );
  };

  const handleMarkAllAsRead = () => {
    setNotifications(prev => prev.map(notif => ({ ...notif, read: true })));
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const getIcon = (type: string) => {
    switch (type) {
      case 'lock':
        return <LockIcon size={18} style={{ color: 'var(--danger)' }} />;
      case 'trend':
        return <TrendingUpIcon size={18} style={{ color: 'var(--accent-1)' }} />;
      case 'bot':
        return <BotIcon size={18} style={{ color: 'var(--warning)' }} />;
      default:
        return <BellIcon size={18} style={{ color: 'var(--text-muted)' }} />;
    }
  };

  return (
    <div className="page">
      <div className="page-narrow">
      <h1 className="page-title">Уведомления</h1>

      {/* Notification Settings */}
      <div className="glass-card" style={{ padding: 20, marginBottom: 24 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 14 }}>
          Типы уведомлений
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Transactions */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '12px 0', borderBottom: '1px solid var(--border-glass)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <TrendingUpIcon size={16} style={{ color: 'var(--accent-1)' }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                  Транзакции
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Депозиты, топапы, выводы
                </div>
              </div>
            </div>
            <label style={{ position: 'relative', width: 44, height: 24 }}>
              <input
                type="checkbox"
                checked={toggles.transactions}
                onChange={() => handleToggle('transactions')}
                style={{ display: 'none' }}
              />
              <div style={{
                position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                background: toggles.transactions ? 'var(--accent-1)' : 'var(--bg-glass)',
                border: '1px solid ' + (toggles.transactions ? 'var(--accent-1)' : 'var(--border-glass)'),
                borderRadius: 12, cursor: 'pointer', transition: 'var(--transition-normal)',
              }} />
              <div style={{
                position: 'absolute', top: 2, left: toggles.transactions ? 22 : 2,
                width: 20, height: 20, background: '#fff', borderRadius: '50%',
                transition: 'var(--transition-normal)',
              }} />
            </label>
          </div>

          {/* Security */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '12px 0', borderBottom: '1px solid var(--border-glass)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <LockIcon size={16} style={{ color: 'var(--danger)' }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                  Безопасность
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Попытки входа, смена пароля
                </div>
              </div>
            </div>
            <label style={{ position: 'relative', width: 44, height: 24 }}>
              <input
                type="checkbox"
                checked={toggles.security}
                onChange={() => handleToggle('security')}
                style={{ display: 'none' }}
              />
              <div style={{
                position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                background: toggles.security ? 'var(--accent-1)' : 'var(--bg-glass)',
                border: '1px solid ' + (toggles.security ? 'var(--accent-1)' : 'var(--border-glass)'),
                borderRadius: 12, cursor: 'pointer', transition: 'var(--transition-normal)',
              }} />
              <div style={{
                position: 'absolute', top: 2, left: toggles.security ? 22 : 2,
                width: 20, height: 20, background: '#fff', borderRadius: '50%',
                transition: 'var(--transition-normal)',
              }} />
            </label>
          </div>

          {/* Promotions */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '12px 0', borderBottom: '1px solid var(--border-glass)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <BotIcon size={16} style={{ color: 'var(--warning)' }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                  Акции и предложения
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Кешбэк, бонусы, специальные предложения
                </div>
              </div>
            </div>
            <label style={{ position: 'relative', width: 44, height: 24 }}>
              <input
                type="checkbox"
                checked={toggles.promotions}
                onChange={() => handleToggle('promotions')}
                style={{ display: 'none' }}
              />
              <div style={{
                position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                background: toggles.promotions ? 'var(--accent-1)' : 'var(--bg-glass)',
                border: '1px solid ' + (toggles.promotions ? 'var(--accent-1)' : 'var(--border-glass)'),
                borderRadius: 12, cursor: 'pointer', transition: 'var(--transition-normal)',
              }} />
              <div style={{
                position: 'absolute', top: 2, left: toggles.promotions ? 22 : 2,
                width: 20, height: 20, background: '#fff', borderRadius: '50%',
                transition: 'var(--transition-normal)',
              }} />
            </label>
          </div>

          {/* System */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '12px 0',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <BellIcon size={16} style={{ color: 'var(--accent-1)' }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                  Системные уведомления
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Обновления, техническая информация
                </div>
              </div>
            </div>
            <label style={{ position: 'relative', width: 44, height: 24 }}>
              <input
                type="checkbox"
                checked={toggles.system}
                onChange={() => handleToggle('system')}
                style={{ display: 'none' }}
              />
              <div style={{
                position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                background: toggles.system ? 'var(--accent-1)' : 'var(--bg-glass)',
                border: '1px solid ' + (toggles.system ? 'var(--accent-1)' : 'var(--border-glass)'),
                borderRadius: 12, cursor: 'pointer', transition: 'var(--transition-normal)',
              }} />
              <div style={{
                position: 'absolute', top: 2, left: toggles.system ? 22 : 2,
                width: 20, height: 20, background: '#fff', borderRadius: '50%',
                transition: 'var(--transition-normal)',
              }} />
            </label>
          </div>
        </div>
      </div>

      {/* Notifications List Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 12,
      }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
          История
          {unreadCount > 0 && (
            <span style={{
              marginLeft: 8, fontSize: 12, padding: '2px 8px',
              background: 'var(--danger)', color: '#fff', borderRadius: 4, fontWeight: 600,
            }}>
              {unreadCount}
            </span>
          )}
        </h2>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllAsRead}
            style={{
              fontSize: 12, color: 'var(--accent-1)', background: 'none', border: 'none',
              cursor: 'pointer', fontWeight: 500,
            }}
          >
            Отметить все как прочитанные
          </button>
        )}
      </div>

      {/* Notifications List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {notifications.map((notif) => (
          <div
            key={notif.id}
            className="glass-card"
            onClick={() => handleMarkAsRead(notif.id)}
            style={{
              padding: '12px 16px',
              display: 'flex', gap: 12,
              cursor: 'pointer',
              background: notif.read ? 'var(--bg-glass)' : 'rgba(99, 102, 241, 0.1)',
              border: notif.read ? '1px solid var(--border-glass)' : '1px solid rgba(99, 102, 241, 0.3)',
              transition: 'var(--transition-normal)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', paddingTop: 2 }}>
              {getIcon(notif.icon)}
            </div>

            <div style={{ flex: 1 }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8,
                marginBottom: 2,
              }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                  {notif.title}
                </div>
                {!notif.read && (
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: 'var(--accent-1)', flexShrink: 0, marginTop: 2,
                  }} />
                )}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                {notif.description}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                {notif.timestamp}
              </div>
            </div>
          </div>
        ))}
      </div>

      {notifications.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <BellIcon size={32} style={{ color: 'var(--text-muted)', marginBottom: 12 }} />
          <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>
            Нет уведомлений
          </p>
        </div>
      )}
      </div>
    </div>
  );
}
