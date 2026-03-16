import { createContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { setTokens, loadTokens, clearTokens, setOnAuthError, getAccessToken } from '../api/client';
import {
  loginWithWebApp,
  loginWithWidget,
  loginWithEmail,
  registerWithEmail,
  loginWithPin,
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
  }, []);

  const logout = useCallback(() => {
    clearTokens();
    setClient(null);
    setIsAuthenticated(false);
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
        // Standalone mode with existing token
        setIsAuthenticated(true);
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
        loginDev: loginDevFn,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
