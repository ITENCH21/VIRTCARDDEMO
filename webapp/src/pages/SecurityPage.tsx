import { useState } from 'react';
import { LockIcon, ShieldIcon, FingerprintIcon, LogOutIcon, EyeIcon, EyeOffIcon } from '../components/icons';

export default function SecurityPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showPIN, setShowPIN] = useState(false);

  // Form states
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pin, setPin] = useState('');
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);

  // Sessions mock data
  const sessions = [
    { id: 1, device: 'iPhone 13', location: 'Moscow, RU', lastActive: 'now', isCurrent: true },
    { id: 2, device: 'MacBook Pro', location: 'Moscow, RU', lastActive: '2 hours ago', isCurrent: false },
    { id: 3, device: 'Chrome Browser', location: 'Saint Petersburg, RU', lastActive: '1 day ago', isCurrent: false },
  ];

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      alert('Пароли не совпадают');
      return;
    }
    // API call would go here
    alert('Пароль успешно изменен');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleChangePIN = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length < 4 || pin.length > 6) {
      alert('PIN должен быть от 4 до 6 цифр');
      return;
    }
    // API call would go here
    alert('PIN успешно установлен');
    setPin('');
  };

  const handleLogoutAll = () => {
    if (confirm('Вы уверены? Вам придется заново войти на всех устройствах.')) {
      alert('Все сессии закрыты');
    }
  };

  const handleLogoutSession = (sessionId: number) => {
    alert(`Сессия на устройстве закрыта`);
  };

  return (
    <div className="page">
      <div className="page-narrow">
      <h1 className="page-title">Безопасность</h1>

      {/* Change Password Section */}
      <div className="glass-card" style={{ padding: 20, marginBottom: 20 }}>
        <h2 style={{
          display: 'flex', alignItems: 'center', gap: 10,
          fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16,
        }}>
          <LockIcon size={18} style={{ color: 'var(--accent-1)' }} />
          Смена пароля
        </h2>

        <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6, display: 'block', fontWeight: 500 }}>
              Текущий пароль
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="form-input"
                placeholder="Введите текущий пароль"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
                  padding: 4, display: 'flex', alignItems: 'center',
                }}
              >
                {showPassword ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
              </button>
            </div>
          </div>

          <div>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6, display: 'block', fontWeight: 500 }}>
              Новый пароль
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="form-input"
                placeholder="Введите новый пароль"
                required
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
                  padding: 4, display: 'flex', alignItems: 'center',
                }}
              >
                {showNewPassword ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
              </button>
            </div>
          </div>

          <div>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6, display: 'block', fontWeight: 500 }}>
              Подтверждение пароля
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="form-input"
              placeholder="Подтвердите пароль"
              required
            />
          </div>

          <button type="submit" className="btn btn-primary">
            Изменить пароль
          </button>
        </form>
      </div>

      {/* PIN Setup Section */}
      <div className="glass-card" style={{ padding: 20, marginBottom: 20 }}>
        <h2 style={{
          display: 'flex', alignItems: 'center', gap: 10,
          fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16,
        }}>
          <ShieldIcon size={18} style={{ color: 'var(--warning)' }} />
          PIN-код (4-6 цифр)
        </h2>

        <form onSubmit={handleChangePIN} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6, display: 'block', fontWeight: 500 }}>
              PIN-код
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPIN ? 'text' : 'password'}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="form-input"
                placeholder="0000"
                maxLength={6}
                inputMode="numeric"
                required
              />
              <button
                type="button"
                onClick={() => setShowPIN(!showPIN)}
                style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
                  padding: 4, display: 'flex', alignItems: 'center',
                }}
              >
                {showPIN ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
              </button>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              {pin.length}/6 цифр
            </div>
          </div>

          <button type="submit" className="btn btn-primary" disabled={pin.length < 4}>
            Установить PIN
          </button>
        </form>
      </div>

      {/* Biometric & 2FA Section */}
      <div className="glass-card" style={{ padding: 20, marginBottom: 20 }}>
        <h2 style={{
          display: 'flex', alignItems: 'center', gap: 10,
          fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16,
        }}>
          <FingerprintIcon size={18} style={{ color: 'var(--success)' }} />
          Дополнительная защита
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Biometric Toggle */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '12px 0', borderBottom: '1px solid var(--border-glass)',
          }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                Face ID / Touch ID
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                Быстрый вход с биометрией
              </div>
            </div>
            <label style={{ position: 'relative', width: 44, height: 24 }}>
              <input
                type="checkbox"
                checked={biometricEnabled}
                onChange={(e) => setBiometricEnabled(e.target.checked)}
                style={{ display: 'none' }}
              />
              <div style={{
                position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                background: biometricEnabled ? 'var(--accent-1)' : 'var(--bg-glass)',
                border: '1px solid ' + (biometricEnabled ? 'var(--accent-1)' : 'var(--border-glass)'),
                borderRadius: 12, cursor: 'pointer', transition: 'var(--transition-normal)',
              }} />
              <div style={{
                position: 'absolute', top: 2, left: biometricEnabled ? 22 : 2,
                width: 20, height: 20, background: '#fff', borderRadius: '50%',
                transition: 'var(--transition-normal)',
              }} />
            </label>
          </div>

          {/* 2FA Toggle */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '12px 0',
          }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                Двухфакторная аутентификация
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                Код из приложения при входе
              </div>
            </div>
            <label style={{ position: 'relative', width: 44, height: 24 }}>
              <input
                type="checkbox"
                checked={twoFactorEnabled}
                onChange={(e) => setTwoFactorEnabled(e.target.checked)}
                style={{ display: 'none' }}
              />
              <div style={{
                position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                background: twoFactorEnabled ? 'var(--accent-1)' : 'var(--bg-glass)',
                border: '1px solid ' + (twoFactorEnabled ? 'var(--accent-1)' : 'var(--border-glass)'),
                borderRadius: 12, cursor: 'pointer', transition: 'var(--transition-normal)',
              }} />
              <div style={{
                position: 'absolute', top: 2, left: twoFactorEnabled ? 22 : 2,
                width: 20, height: 20, background: '#fff', borderRadius: '50%',
                transition: 'var(--transition-normal)',
              }} />
            </label>
          </div>
        </div>
      </div>

      {/* Active Sessions */}
      <div className="glass-card" style={{ padding: 20, marginBottom: 20 }}>
        <h2 style={{
          fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16,
        }}>
          Активные сессии
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sessions.map((session) => (
            <div
              key={session.id}
              style={{
                padding: '12px 14px', background: 'var(--bg-glass)', border: '1px solid var(--border-glass)',
                borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                  {session.device}
                  {session.isCurrent && (
                    <span style={{
                      marginLeft: 8, fontSize: 11, padding: '2px 8px',
                      background: 'var(--accent-1)', color: '#fff', borderRadius: 4, fontWeight: 600,
                    }}>
                      Текущая
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                  {session.location} • {session.lastActive}
                </div>
              </div>
              {!session.isCurrent && (
                <button
                  onClick={() => handleLogoutSession(session.id)}
                  style={{
                    padding: '6px 10px', fontSize: 11, color: 'var(--danger)',
                    background: 'transparent', border: '1px solid var(--danger)',
                    borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 500,
                    transition: 'var(--transition-normal)',
                  }}
                >
                  Выход
                </button>
              )}
            </div>
          ))}
        </div>

        <button
          onClick={handleLogoutAll}
          className="btn btn-danger"
          style={{ marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
          <LogOutIcon size={16} /> Выход со всех устройств
        </button>
      </div>

      {/* Security Tips */}
      <div className="glass-card" style={{
        padding: 14,
        background: 'linear-gradient(135deg, rgba(34,197,94,0.1) 0%, rgba(59,130,246,0.05) 100%)',
        border: '1px solid rgba(34,197,94,0.2)',
      }}>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          🔐 <strong>Совет:</strong> Регулярно проверяйте активные сессии и используйте сильные пароли. Никогда не делитесь кодом 2FA с никем.
        </p>
      </div>
      </div>
    </div>
  );
}
