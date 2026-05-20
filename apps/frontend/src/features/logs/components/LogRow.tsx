import { memo } from 'react';
import { Log } from '../types/logs.types';
import { SeverityBadge } from './SeverityBadge';

interface LogRowProps {
  log: Log;
}

// GOOD: Memoize row to prevent re-renders when other rows change
// React.memo performs shallow comparison of props - only re-renders if log object reference changes
export const LogRow = memo(({ log }: LogRowProps) => {
  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50">
      {/* Timestamp column - formatted to user's locale */}
      <td className="py-2 px-4 text-sm text-gray-600">
        {new Date(log.timestamp).toLocaleString()}
      </td>

      {/* Severity column with color-coded badge */}
      <td className="py-2 px-4">
        <SeverityBadge level={log.severity} />
      </td>

      {/* Source column */}
      <td className="py-2 px-4 text-sm">{log.source}</td>

      {/* Message column - monospace font for log readability */}
      <td className="py-2 px-4 text-sm font-mono">{log.message}</td>
    </tr>
  );
});

LogRow.displayName = 'LogRow';

// GOOD: Memoization prevents unnecessary re-renders
// When 1000 logs are displayed and one is added, only the new row renders

// BAD: Inline callbacks break memo
// <LogRow onClick={() => handleClick(log.id)} />
// Solution: Wrap callback in useCallback or pass stable handler

// BAD: No memoization (re-renders on every parent update)
// export function LogRow({ log }) { ... }
