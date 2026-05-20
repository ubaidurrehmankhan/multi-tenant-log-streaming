// GOOD: Empty state with helpful context
// Shows when query returns no results (filters too restrictive, no data for tenant)
export function EmptyState() {
  return (
    <div className="text-center p-8 text-gray-500">
      {/* Icon placeholder for better visual hierarchy */}
      <div className="mb-4">
        <svg
          className="mx-auto h-12 w-12 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      </div>

      {/* Primary message */}
      <p className="text-lg font-medium text-gray-700 mb-2">No logs found</p>

      {/* Helpful guidance */}
      <p className="text-sm text-gray-500">
        Try adjusting your filters or selecting a different tenant.
      </p>
    </div>
  );
}

// GOOD: Explains why empty and suggests action
// GOOD: Light theme, clear visual hierarchy
// BAD: Empty div with no explanation (users think app is broken)
// BAD: Using same styling as error state (confuses empty vs error)
