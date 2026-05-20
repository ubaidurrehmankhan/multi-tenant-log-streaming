import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io, Socket } from 'socket.io-client';
import { useTenantStore } from '../../../stores/tenant.store';
import { apiClient } from '../../../lib/api-client';
import { Log } from '../types/logs.types';
import { LogFilters } from './useLogs';

// CRITICAL: Backend uses Socket.IO - frontend MUST use socket.io-client library
// BAD: Using native WebSocket (incompatible with Socket.IO backend)
export function useLogStream(filters: LogFilters = {}) {
  const { currentTenant } = useTenantStore();
  const queryClient = useQueryClient();
  const normalizedSearch = filters.searchTerm?.trim().toLowerCase();

  useEffect(() => {
    // Don't connect if no tenant is selected
    if (!currentTenant) return;

    // GOOD: Use same base URL as API client for consistency
    // Ensures WebSocket connects to same backend as REST API
    const wsUrl = apiClient.defaults.baseURL || 'http://localhost:3000';

    // GOOD: Use Socket.IO client (matches backend)
    const socket: Socket = io(wsUrl, {
      transports: ['websocket'],
      autoConnect: true
    });

    socket.on('connect', () => {
      // Subscribe with tenant and filters
      socket.emit('subscribe', {
        tenantId: currentTenant,
        severity: filters.severity
      });
    });

    // Listen for 'log' event from backend (NOT generic onmessage like native WebSocket)
    socket.on('log', (log: Log) => {
      // Keep live updates consistent with currently active UI filters.
      if (filters.severity && log.severity !== filters.severity) {
        return;
      }

      if (normalizedSearch && !log.message.toLowerCase().includes(normalizedSearch)) {
        return;
      }

      // GOOD: Prepend to existing cache
      queryClient.setQueryData(
        ['logs', currentTenant, filters],
        (oldData: any) => {
          if (!oldData) return oldData;
          return {
            ...oldData,
            pages: [
              { items: [log, ...oldData.pages[0].items], nextCursor: oldData.pages[0].nextCursor },
              ...oldData.pages.slice(1)
            ]
          };
        }
      );
    });

    // CRITICAL: Disconnect and cleanup on unmount
    return () => {
      socket.disconnect();
    };
  }, [currentTenant, filters, normalizedSearch, queryClient]);
}

// GOOD: Cleanup on unmount, updates React Query cache, uses Socket.IO
// BAD: Using native WebSocket (incompatible with Socket.IO backend)
// BAD: Creating multiple connections (missing dependency tracking)
