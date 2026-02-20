import { createContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { setTokens, loadTokens, clearTokens, setOnAuthError, getAccessToken } from '../api/client';
import { loginWithWebApp, loginWithWidget, AuthResponse } from '../api/auth';
import { isTelegramWebApp, getInitData, ready, expand } from '../lib/telegram';

interface ClientInfo {
  id: string;
  name: string;
  telegram_username: string | null;
}

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  client: ClientInfo | null;
  loginTelegram: (data: Record<string, string | number>) => Promise<void>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  isLoading: true,
  client: null,
  loginTelegram: async () => {},
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

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, client, loginTelegram, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
