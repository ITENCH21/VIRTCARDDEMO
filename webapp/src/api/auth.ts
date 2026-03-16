import { apiFetch } from './client';

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  client: {
    id: string;
    name: string;
    telegram_username: string | null;
    email?: string | null;
    has_pin?: boolean;
    has_webauthn?: boolean;
  };
}

// ── Telegram Auth ────────────────────────────────────────

export function loginWithWebApp(initData: string): Promise<AuthResponse> {
  return apiFetch('/auth/telegram-webapp', {
    method: 'POST',
    body: JSON.stringify({ init_data: initData }),
  });
}

export function loginWithWidget(data: Record<string, string | number>): Promise<AuthResponse> {
  return apiFetch('/auth/telegram-login', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ── Email/Password Auth ──────────────────────────────────

export function loginWithEmail(email: string, password: string): Promise<AuthResponse> {
  return apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function registerWithEmail(
  email: string,
  password: string,
  name: string
): Promise<AuthResponse> {
  return apiFetch('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, name }),
  });
}

// ── PIN Auth ─────────────────────────────────────────────

export function loginWithPin(pin: string): Promise<AuthResponse> {
  return apiFetch('/auth/pin-login', {
    method: 'POST',
    body: JSON.stringify({ pin }),
  });
}

export function setupPin(pin: string): Promise<{ success: boolean }> {
  return apiFetch('/auth/pin-setup', {
    method: 'POST',
    body: JSON.stringify({ pin }),
  });
}

// ── WebAuthn (Biometric) Auth ────────────────────────────

export interface WebAuthnRegisterOptions {
  publicKey: PublicKeyCredentialCreationOptions;
}

export interface WebAuthnLoginOptions {
  publicKey: PublicKeyCredentialRequestOptions;
}

export function getWebAuthnRegisterOptions(): Promise<WebAuthnRegisterOptions> {
  return apiFetch('/auth/webauthn/register-options', { method: 'POST' });
}

export function completeWebAuthnRegister(credential: unknown): Promise<{ success: boolean }> {
  return apiFetch('/auth/webauthn/register-complete', {
    method: 'POST',
    body: JSON.stringify(credential),
  });
}

export function getWebAuthnLoginOptions(): Promise<WebAuthnLoginOptions> {
  return apiFetch('/auth/webauthn/login-options', { method: 'POST' });
}

export function completeWebAuthnLogin(credential: unknown): Promise<AuthResponse> {
  return apiFetch('/auth/webauthn/login-complete', {
    method: 'POST',
    body: JSON.stringify(credential),
  });
}

// ── Magic Link Auth ─────────────────────────────────────

export function loginWithMagicLink(token: string): Promise<AuthResponse> {
  return apiFetch('/auth/magic-link', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
}

// ── Dev Login ────────────────────────────────────────────

export function devLogin(telegramId: number): Promise<AuthResponse> {
  return apiFetch('/auth/dev-login', {
    method: 'POST',
    body: JSON.stringify({ telegram_id: telegramId }),
  });
}
