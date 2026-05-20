import { useRef, useCallback } from 'react';
import { Log } from '../types/logs.types';

interface Props {
  logs: Log[];
  hasNextPage?: boolean;
  fetchNextPage: () => void;
  isFetchingNextPage: boolean;
}

// Severity badge component
function SeverityBadge({ level }: { level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' }) {
  const colors = {
    DEBUG: 'bg-gray-100 text-gray-800 border-gray-300',
    INFO: 'bg-blue-100 text-blue-800 border-blue-300',
    WARN: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    ERROR: 'bg-red-100 text-red-800 border-red-300'
  };

  return (
    <span className={`px-2 py-1 text-xs font-semibold rounded border ${colors[level]}`}>
      {level}
    </span>
  );
}

export function LogsTable({ logs, hasNextPage, fetchNextPage, isFetchingNextPage }: Props) {
  // GOOD: IntersectionObserver (native, performant)
  // BAD: Scroll event listener (performance drag, memory leaks)
  const observerRef = useRef<IntersectionObserver | undefined>(undefined);

  const lastRowRef = useCallback(
    (node: HTMLTableRowElement | null) => {
      if (isFetchingNextPage) return;
      if (observerRef.current) observerRef.current.disconnect();

      observerRef.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasNextPage) {
          fetchNextPage();
        }
      });

      if (node) observerRef.current.observe(node);
    },
    [isFetchingNextPage, hasNextPage, fetchNextPage]
  );

  if (logs.length === 0) {
    return (
      <div className="text-center p-8 text-gray-500 bg-white rounded-lg border-2 border-gray-200">
        <p>No logs found</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border-2 border-lime-400 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-lime-100 border-b-2 border-lime-400">
            <tr>
              <th className="py-3 px-4 text-left text-sm font-semibold text-gray-800">Timestamp</th>
              <th className="py-3 px-4 text-left text-sm font-semibold text-gray-800">Severity</th>
              <th className="py-3 px-4 text-left text-sm font-semibold text-gray-800">Source</th>
              <th className="py-3 px-4 text-left text-sm font-semibold text-gray-800">Message</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log, index) => (
              <tr
                key={log.id}
                ref={index === logs.length - 1 ? lastRowRef : null}
                className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
              >
                <td className="py-2 px-4 text-sm text-gray-600 whitespace-nowrap">
                  {new Date(log.timestamp).toLocaleString()}
                </td>
                <td className="py-2 px-4">
                  <SeverityBadge level={log.severity} />
                </td>
                <td className="py-2 px-4 text-sm text-gray-700">{log.source}</td>
                <td className="py-2 px-4 text-sm font-mono text-gray-900">{log.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Loading indicator at bottom when fetching next page */}
      {isFetchingNextPage && (
        <div className="py-4 text-center bg-lime-50 border-t border-lime-200">
          <div className="inline-flex items-center gap-2 text-lime-700">
            <div className="w-4 h-4 border-2 border-lime-600 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-sm font-medium">Loading more logs...</span>
          </div>
        </div>
      )}

      {/* End of data indicator */}
      {!hasNextPage && logs.length > 0 && (
        <div className="py-3 text-center bg-gray-50 border-t border-gray-200">
          <p className="text-sm text-gray-500">No more logs to load</p>
        </div>
      )}
    </div>
  );
}

// GOOD: IntersectionObserver (native, performant)
// GOOD: Disconnect observer when loading or component unmounts
// BAD: Scroll event listeners (performance drag, memory leaks)
// BAD: Not disconnecting observer (memory leak)
