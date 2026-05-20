import { useInfiniteQuery } from '@tanstack/react-query';
import { useTenantStore } from '../../../stores/tenant.store';
import { fetchLogs } from '../api/logs.api';
import { LogsResponse } from '../types/logs.types';

export interface LogFilters {
  severity?: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  searchTerm?: string;
  limit?: number;
}

// GOOD: Infinite query hook with cursor pagination
export function useLogs(filters: LogFilters = {}) {
  const { currentTenant } = useTenantStore(); // Global state requirement

  return useInfiniteQuery<LogsResponse, Error>({
    // GOOD: Query key includes tenant and filters for cache isolation
    queryKey: ['logs', currentTenant, filters],
    queryFn: ({ pageParam }) =>
      fetchLogs({
        tenantId: currentTenant!,
        cursor: pageParam as string | undefined,
        limit: filters.limit,
        severity: filters.severity,
        searchTerm: filters.searchTerm
      }),
    // CRITICAL: initialPageParam required for react-query v5
    initialPageParam: undefined,
    // GOOD: Return cursor for next page
    getNextPageParam: (lastPage: LogsResponse) => lastPage.nextCursor ?? undefined,
    // GOOD: Stale time for append-only data (logs don't change, only new ones added)
    staleTime: 30_000, // Logs are append-only, don't refetch aggressively
    // GOOD: Don't fetch without tenant
    enabled: !!currentTenant // Only fetch when tenant is selected
  });
}

// GOOD: Query key includes tenant and filters for cache isolation
// BAD: Missing tenant in query key (stale data across tenant switches)
// BAD: Aggressive refetch with refetchInterval (logs are append-only)
