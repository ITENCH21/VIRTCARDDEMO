import { createContext, useEffect, ReactNode } from 'react';
import { getThemeParams, isTelegramWebApp } from '../lib/telegram';

export const ThemeContext = createContext({});

export function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (isTelegramWebApp()) {
      const params = getThemeParams();
      const root = document.documentElement;
      // Map TG theme vars to CSS custom properties
      if (params.bg_color) root.style.setProperty('--bg-color', params.bg_color);
      if (params.text_color) root.style.setProperty('--text-color', params.text_color);
      if (params.hint_color) root.style.setProperty('--hint-color', params.hint_color);
      if (params.link_color) root.style.setProperty('--link-color', params.link_color);
      if (params.button_color) root.style.setProperty('--button-color', params.button_color);
      if (params.button_text_color) root.style.setProperty('--button-text-color', params.button_text_color);
      if (params.secondary_bg_color) root.style.setProperty('--secondary-bg-color', params.secondary_bg_color);
    }
  }, []);

  return (
    <ThemeContext.Provider value={{}}>
      {children}
    </ThemeContext.Provider>
  );
}
