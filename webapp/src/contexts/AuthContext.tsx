import { createContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { apiFetch, setTokens, loadTokens, clearTokens, setOnAuthError, getAccessToken } from '../api/client';
import {
  loginWithWebApp,
  loginWithWidget,
  loginWithEmail,
  registerWithEmail,
  loginWithPin,
  loginWithMagicLink,
  devLogin,
  AuthResponse,
} from '../api/auth';
import { isTelegramWebApp, getInitData, ready, expand } from '../lib/telegram';

interface ClientInfo {
  id: string;
  name: string;
  telegram_username: string | null;
  email?: string | null;
  has_pin?: boolean;
  has_webauthn?: boolean;
}

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  client: ClientInfo | null;
  loginTelegram: (data: Record<string, string | number>) => Promise<void>;
  loginEmail: (email: string, password: string) => Promise<void>;
  registerEmail: (email: string, password: string, name: string) => Promise<void>;
  loginPin: (pin: string) => Promise<void>;
  loginMagicLink: (token: string) => Promise<void>;
  loginDev: (telegramId: number) => Promise<void>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  isLoading: true,
  client: null,
  loginTelegram: async () => {},
  loginEmail: async () => {},
  registerEmail: async () => {},
  loginPin: async () => {},
  loginMagicLink: async () => {},
  loginDev: async () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [client, setClient] = useState<ClientInfo | null>(null);

  const handleAuthResponse = useCallback((data: AuthResponse) => {
    setTokens(data.access_token, data.refresh_token);
    setClient(data.client);
    setIsAuthenticated(true);
    try { localStorage.setItem('client_info', JSON.stringify(data.client)); } catch {}
  }, []);

  const logout = useCallback(() => {
    clearTokens();
    setClient(null);
    setIsAuthenticated(false);
    try { localStorage.removeItem('client_info'); } catch {}
  }, []);

  // Auto-login for Telegram Mini App
  useEffect(() => {
    setOnAuthError(logout);
    loadTokens();

    const init = async () => {
      // If we're in Telegram Mini App, auto-login
      if (isTelegramWebApp()) {
        ready();
        expand();
        const initData = getInitData();
        if (initData) {
          try {
            const data = await loginWithWebApp(initData);
            handleAuthResponse(data);
          } catch {
            // initData invalid, fall through to login page
          }
        }
      } else if (getAccessToken()) {
        // Standalone mode with existing token — restore client from localStorage or API
        setIsAuthenticated(true);
        try {
          const stored = localStorage.getItem('client_info');
          if (stored) {
            setClient(JSON.parse(stored));
          } else {
            // Fallback: fetch profile from API
            const profile = await apiFetch<{ name: string; telegram_username: string | null; email?: string | null }>('/profile');
            const clientInfo = { id: '', name: profile.name, telegram_username: profile.telegram_username, email: profile.email };
            setClient(clientInfo);
            localStorage.setItem('client_info', JSON.stringify(clientInfo));
          }
        } catch {}
      }
      setIsLoading(false);
    };

    init();
  }, [handleAuthResponse, logout]);

  const loginTelegram = useCallback(
    async (data: Record<string, string | number>) => {
      const res = await loginWithWidget(data);
      handleAuthResponse(res);
    },
    [handleAuthResponse]
  );

  const loginEmailFn = useCallback(
    async (email: string, password: string) => {
      const res = await loginWithEmail(email, password);
      handleAuthResponse(res);
    },
    [handleAuthResponse]
  );

  const registerEmailFn = useCallback(
    async (email: string, password: string, name: string) => {
      const res = await registerWithEmail(email, password, name);
      handleAuthResponse(res);
    },
    [handleAuthResponse]
  );

  const loginPinFn = useCallback(
    async (pin: string) => {
      const res = await loginWithPin(pin);
      handleAuthResponse(res);
    },
    [handleAuthResponse]
  );

  const loginMagicLinkFn = useCallback(
    async (token: string) => {
      const res = await loginWithMagicLink(token);
      handleAuthResponse(res);
    },
    [handleAuthResponse]
  );

  const loginDevFn = useCallback(
    async (telegramId: number) => {
      const res = await devLogin(telegramId);
      handleAuthResponse(res);
    },
    [handleAuthResponse]
  );

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        client,
        loginTelegram,
        loginEmail: loginEmailFn,
        registerEmail: registerEmailFn,
        loginPin: loginPinFn,
        loginMagicLink: loginMagicLinkFn,
        loginDev: loginDevFn,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
