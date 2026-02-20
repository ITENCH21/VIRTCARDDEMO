import { apiFetch } from './client';

export interface AccountInfo {
  id: string;
  currency_code: string;
  currency_symbol: string;
  balance: string;
  available: string;
  address: string | null;
}

export interface BalanceResponse {
  accounts: AccountInfo[];
}

export function fetchBalance(): Promise<BalanceResponse> {
  return apiFetch('/balance');
}
