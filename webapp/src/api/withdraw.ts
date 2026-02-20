import { apiFetch } from './client';
import { OperationCreatedResponse } from './cards';

export interface WithdrawEstimateResponse {
  amount: string;
  fee: string;
  total: string;
  currency_symbol: string;
  fee_percent: string;
  fee_fixed: string;
  fee_minimal: string;
}

export function estimateWithdraw(amount: string): Promise<WithdrawEstimateResponse> {
  return apiFetch('/withdraw/estimate', {
    method: 'POST',
    body: JSON.stringify({ amount }),
  });
}

export function createWithdraw(amount: string, address: string): Promise<OperationCreatedResponse> {
  return apiFetch('/withdraw', {
    method: 'POST',
    body: JSON.stringify({ amount, address }),
  });
}
