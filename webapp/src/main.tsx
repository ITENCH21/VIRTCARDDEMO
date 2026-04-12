import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { LayoutProvider } from './contexts/LayoutContext';
import { LangProvider } from './contexts/LangContext';
import './styles/globals.css';
import './styles/theme.css';

async function unregisterLegacyServiceWorkers() {
  if (!('serviceWorker' in navigator)) return;

  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      regs.map(async (reg) => {
        const scope = reg.scope || '';
        if (!scope.includes('/public/')) {
          await reg.unregister();
        }
      })
    );

    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith('virtcardpay-'))
          .map((key) => caches.delete(key))
      );
    }
  } catch {
    // Ignore cleanup failures outside supported browsers/webviews.
  }
}

void unregisterLegacyServiceWorkers();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter basename="/app">
      <ThemeProvider>
        <LayoutProvider mode="mobile">
          <LangProvider>
            <AuthProvider>
              <App />
            </AuthProvider>
          </LangProvider>
        </LayoutProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);
