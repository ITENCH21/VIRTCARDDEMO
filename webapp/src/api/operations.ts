import { apiFetch } from './client';

export interface OperationResponse {
  id: string;
  kind: string;
  kind_label: string;
  status: string;
  amount: string;
  currency_symbol: string;
  created_at: string;
}

export interface OperationListResponse {
  items: OperationResponse[];
  total: number;
}

export interface OperationStatusResponse {
  id: string;
  status: string;
}

export function fetchOperations(offset = 0, limit = 10): Promise<OperationListResponse> {
  return apiFetch(`/operations?offset=${offset}&limit=${limit}`);
}

export function fetchOperationStatus(id: string): Promise<OperationStatusResponse> {
  return apiFetch(`/operations/${id}/status`);
}
