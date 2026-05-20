import { memo } from 'react';

interface SeverityBadgeProps {
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
}

// GOOD: Color-coded severity with Tailwind classes
const severityColors = {
  DEBUG: 'bg-gray-100 text-gray-700',
  INFO: 'bg-blue-100 text-blue-700',
  WARN: 'bg-yellow-100 text-yellow-700',
  ERROR: 'bg-red-100 text-red-700'
};

// GOOD: Memoize to prevent re-renders when parent updates
export const SeverityBadge = memo(({ level }: SeverityBadgeProps) => {
  return (
    <span
      className={`px-2 py-1 rounded text-xs font-semibold ${severityColors[level]}`}
    >
      {level}
    </span>
  );
});

SeverityBadge.displayName = 'SeverityBadge';

// BAD: Inline style objects (breaks memo optimization)
// <span style={{ color: level === 'ERROR' ? 'red' : 'blue' }}>
