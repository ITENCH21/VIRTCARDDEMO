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

export interface OperationFilters {
  kind?: string;
  status?: string;
}

export function fetchOperations(
  offset = 0,
  limit = 10,
  filters?: OperationFilters,
): Promise<OperationListResponse> {
  const params = new URLSearchParams({
    offset: String(offset),
    limit: String(limit),
  });
  if (filters?.kind) params.set('kind', filters.kind);
  if (filters?.status) params.set('status', filters.status);
  return apiFetch(`/operations?${params}`);
}

export function fetchOperationStatus(id: string): Promise<OperationStatusResponse> {
  return apiFetch(`/operations/${id}/status`);
}
