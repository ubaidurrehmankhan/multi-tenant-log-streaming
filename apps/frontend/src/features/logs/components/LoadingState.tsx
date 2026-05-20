// GOOD: Loading state with spinner animation
// Used when async data is being fetched (initial load or refetch)
export function LoadingState() {
  return (
    <div className="flex justify-center items-center p-8">
      {/* Tailwind animate-spin for smooth spinner animation */}
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-lime-500"></div>
      <span className="ml-3 text-gray-600">Loading logs...</span>
    </div>
  );
}

// GOOD: Light theme with lime accent (matches design system)
// BAD: Heavy animations that distract from content
// BAD: Missing loading state (users see blank screen)
