import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { getTelegramWebApp } from '../lib/telegram';

interface ThemeContextType {
  isDark: boolean;
  toggleTheme: () => void;
}

export const ThemeContext = createContext<ThemeContextType>({
  isDark: true,
  toggleTheme: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [isDark, setIsDark] = useState(() => {
    // Check Telegram colorScheme first
    const tg = getTelegramWebApp();
    if (tg?.colorScheme) {
      return tg.colorScheme === 'dark';
    }
    // Fallback: check localStorage or default to dark
    const saved = localStorage.getItem('theme');
    return saved !== 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.remove('light');
    } else {
      root.classList.add('light');
    }
  }, [isDark]);

  const toggleTheme = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      localStorage.setItem('theme', next ? 'dark' : 'light');
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
