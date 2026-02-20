import { apiFetch } from './client';

export interface CardResponse {
  id: string;
  name: string;
  last4: string;
  status: string;
  balance: string;
  currency_code: string;
  currency_symbol: string;
}

export interface CardSensitiveResponse {
  card_number: string;
  cvv: string;
  expiry_month: string;
  expiry_year: string;
}

export interface EstimateResponse {
  amount: string;
  fee: string;
  total: string;
  currency_symbol: string;
}

export interface OperationCreatedResponse {
  operation_id: string;
  status: string;
}

export function fetchCards(): Promise<CardResponse[]> {
  return apiFetch('/cards');
}

export function fetchCard(id: string): Promise<CardResponse> {
  return apiFetch(`/cards/${id}`);
}

export function fetchCardSensitive(id: string): Promise<CardSensitiveResponse> {
  return apiFetch(`/cards/${id}/sensitive`);
}

export function estimateIssue(amount: string): Promise<EstimateResponse> {
  return apiFetch('/cards/estimate', {
    method: 'POST',
    body: JSON.stringify({ amount }),
  });
}

export function issueCard(amount: string, cardName: string = ''): Promise<OperationCreatedResponse> {
  return apiFetch('/cards/issue', {
    method: 'POST',
    body: JSON.stringify({ amount, card_name: cardName }),
  });
}

export function estimateTopup(cardId: string, amount: string): Promise<EstimateResponse> {
  return apiFetch(`/cards/${cardId}/estimate-topup`, {
    method: 'POST',
    body: JSON.stringify({ amount }),
  });
}

export function topupCard(cardId: string, amount: string): Promise<OperationCreatedResponse> {
  return apiFetch(`/cards/${cardId}/topup`, {
    method: 'POST',
    body: JSON.stringify({ amount }),
  });
}

export function blockCard(cardId: string): Promise<OperationCreatedResponse> {
  return apiFetch(`/cards/${cardId}/block`, { method: 'POST' });
}

export function restoreCard(cardId: string): Promise<OperationCreatedResponse> {
  return apiFetch(`/cards/${cardId}/restore`, { method: 'POST' });
}

export function closeCard(cardId: string): Promise<OperationCreatedResponse> {
  return apiFetch(`/cards/${cardId}/close`, { method: 'POST' });
}
