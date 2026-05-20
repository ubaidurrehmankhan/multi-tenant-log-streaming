import { apiClient, ApiResponse } from '../../../lib/api-client';
import { LogsResponse, QueryLogsDto } from '../types/logs.types';

// GOOD: Typed response with proper extraction
export async function fetchLogs(params: QueryLogsDto): Promise<LogsResponse> {
  const { tenantId, ...queryParams } = params;

  const { data } = await apiClient.get<ApiResponse<LogsResponse>>('/v1/logs', {
    params: queryParams,
    headers: { 'X-Tenant-ID': tenantId }
  });

  // CRITICAL: Extract from envelope
  if (!data.success || !data.data) {
    throw new Error(data.error?.message || 'Failed to fetch logs');
  }

  return data.data;
}

// GOOD: Proper error handling
// BAD: Missing tenant header (would get 400 error)
// BAD: Accessing data.data without checking success field
