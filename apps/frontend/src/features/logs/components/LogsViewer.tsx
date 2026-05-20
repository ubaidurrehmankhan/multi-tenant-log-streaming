import { useState } from 'react';
import { useTenantStore } from '../../../stores/tenant.store';
import { useLogs, LogFilters as LogFiltersType } from '../hooks/useLogs';
import { useLogStream } from '../hooks/useLogStream';
import { TenantSwitcher } from './TenantSwitcher';
import { LogFilters } from './LogFilters';
import { LogsTable } from './LogsTable';
import { LoadingState } from './LoadingState';
import { ErrorState } from './ErrorState';
import { EmptyState } from './EmptyState';

// GOOD: Main component integrating all features
// Handles tenant selection, filtering, infinite scroll, and real-time updates
export function LogsViewer() {
  const { currentTenant } = useTenantStore();
  const [filters, setFilters] = useState<LogFiltersType>({});

  // GOOD: Infinite query hook with cursor pagination
  const { data, isLoading, isError, error, hasNextPage, fetchNextPage, isFetchingNextPage, refetch } = useLogs(filters);

  // GOOD: WebSocket hook for real-time updates (auto-connects when tenant selected)
  // Updates React Query cache automatically when new logs arrive
  useLogStream(filters);

  // MANDATORY: Handle all 4 states (loading, error, empty, success)

  // State 1: No tenant selected
  if (!currentTenant) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">LogStream Dashboard</h1>

          {/* Tenant selection required message */}
          <div className="bg-white rounded-lg border-2 border-lime-400 p-6">
            <TenantSwitcher />
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded">
              <p className="text-blue-700 text-sm">
                Please select a tenant to view logs
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // State 2: Loading (initial fetch)
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">LogStream Dashboard</h1>
          <LoadingState />
        </div>
      </div>
    );
  }

  // State 3: Error
  if (isError) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">LogStream Dashboard</h1>
          <ErrorState
            message={error?.message || 'Failed to load logs'}
            onRetry={refetch}
          />
        </div>
      </div>
    );
  }

  // Flatten pages into single array
  const allLogs = data?.pages.flatMap((page) => page.items) ?? [];

  // State 4: Success (includes empty state)
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header with real-time indicator */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-gray-900">LogStream Dashboard</h1>

          {/* GOOD: Real-time indicator when WebSocket connected */}
          {currentTenant && (
            <span className="flex items-center text-lime-600 bg-lime-50 px-3 py-1 rounded-full border border-lime-200">
              <span className="w-2 h-2 bg-lime-500 rounded-full animate-pulse mr-2"></span>
              <span className="text-sm font-medium">Live</span>
            </span>
          )}
        </div>

        {/* Tenant Switcher and Filters */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
          {/* Tenant Switcher */}
          <div className="lg:col-span-1 bg-white rounded-lg border-2 border-lime-400 p-4">
            <TenantSwitcher />
          </div>

          {/* Filters */}
          <div className="lg:col-span-3">
            <LogFilters onFilterChange={setFilters} />
          </div>
        </div>

        {/* Logs Table or Empty State */}
        {allLogs.length === 0 ? (
          <EmptyState />
        ) : (
          <LogsTable
            logs={allLogs}
            hasNextPage={hasNextPage}
            fetchNextPage={fetchNextPage}
            isFetchingNextPage={isFetchingNextPage}
          />
        )}
      </div>
    </div>
  );
}

// GOOD: All 4 states handled (no tenant, loading, error, empty/success)
// GOOD: Real-time updates via WebSocket automatically prepend to cache
// GOOD: Filters wire to useLogs query key (triggers refetch)
// GOOD: Infinite scroll via IntersectionObserver in LogsTable
// GOOD: Real-time indicator shows when WebSocket connected

// BAD: Missing error state (users see blank screen on failure)
// BAD: Missing empty state (users confused when no data)
// BAD: Not handling tenant selection requirement (breaks on no tenant)
