import { apiFetch } from './client';

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  client: {
    id: string;
    name: string;
    telegram_username: string | null;
  };
}

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
