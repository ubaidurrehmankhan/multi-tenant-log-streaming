interface ErrorStateProps {
  message: string;
  onRetry: () => void;
}

// GOOD: Error state with retry action
// Allows users to recover from transient failures (network errors, timeouts)
export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="bg-red-50 border border-red-200 rounded p-4 mx-4 my-8">
      {/* Error message with clear visual hierarchy */}
      <p className="text-red-700 font-medium mb-2">Error</p>
      <p className="text-red-600 text-sm mb-4">{message}</p>

      {/* Retry button with lime accent for consistency */}
      <button
        onClick={onRetry}
        className="px-4 py-2 bg-lime-500 text-white rounded hover:bg-lime-600 transition-colors text-sm font-medium"
      >
        Retry
      </button>
    </div>
  );
}

// GOOD: Provides actionable retry mechanism
// GOOD: Light theme with clear error indication
// BAD: No error state (users confused when nothing loads)
// BAD: Generic "Something went wrong" without specific message
