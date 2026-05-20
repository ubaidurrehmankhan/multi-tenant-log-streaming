// GOOD: Interface matches backend exactly
export interface Log {
  id: string;
  tenantId: string;
  timestamp: string;
  severity: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  source: string;
  message: string;
  metadata?: Record<string, unknown> | null;
}

export interface LogsResponse {
  items: Log[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface QueryLogsDto {
  tenantId: string;
  cursor?: string;
  limit?: number;
  severity?: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  searchTerm?: string;
}
