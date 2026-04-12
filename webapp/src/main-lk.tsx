import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import AppLK from './AppLK';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { LangProvider } from './contexts/LangContext';
import { LayoutProvider } from './contexts/LayoutContext';
import { setTokens, clearTokens } from './api/client';
import './styles/globals.css';
import './styles/theme.css';

// ── Handle magic link BEFORE React mounts (avoids StrictMode double-fire) ──
(async () => {
  const url = new URL(window.location.href);
  // Check if we're on /lk/auth with a token param
  if (url.pathname === '/lk/auth' && url.searchParams.has('token')) {
    const token = url.searchParams.get('token')!;

    // Clear old session
    clearTokens();
    try { localStorage.removeItem('client_info'); } catch {}

    try {
      const res = await fetch('/api/v1/auth/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      if (res.ok) {
        const data = await res.json();
        setTokens(data.access_token, data.refresh_token);
        if (data.client) {
          localStorage.setItem('client_info', JSON.stringify(data.client));
        }
        // Redirect to dashboard — clean URL
        window.location.replace('/lk/');
        return; // stop — page will reload
      }
    } catch {}

    // If we get here, token was invalid — let MagicLinkAuthPage show error
  }

  // Normal boot — render React
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <BrowserRouter basename="/lk">
      <ThemeProvider>
        <LayoutProvider mode="desktop">
          <LangProvider>
            <AuthProvider>
              <AppLK />
            </AuthProvider>
          </LangProvider>
        </LayoutProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
})();
