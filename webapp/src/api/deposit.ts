import { apiFetch } from './client';

export interface DepositResponse {
  address: string | null;
  currency_code: string;
  qr_data: string | null;
}

export function fetchDeposit(): Promise<DepositResponse> {
  return apiFetch('/deposit');
}
