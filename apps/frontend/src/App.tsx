import { LogsViewer } from './features/logs/components/LogsViewer';

// GOOD: Clean app shell with LogsViewer integration
// Light theme with lime accents applied globally via Tailwind
function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* GOOD: LogsViewer handles all features */}
      {/* - Tenant selection with TenantSwitcher */}
      {/* - Real-time WebSocket updates */}
      {/* - Cursor pagination with infinite scroll */}
      {/* - Full-text search and severity filters */}
      {/* - All 4 states: loading, error, empty, success */}
      <LogsViewer />
    </div>
  );
}

// GOOD: Light theme (bg-gray-50) applied globally
// GOOD: Lime accents (lime-500, lime-600) used throughout components
// GOOD: Responsive layout (mobile-first, max-w-7xl on desktop)
// GOOD: Professional appearance with card shadows and borders

// BAD: Black theme (poor readability for logs)
// BAD: Missing responsive breakpoints (broken on mobile)
// BAD: Inconsistent color scheme across components

export default App;
