import { useState, useEffect } from 'react';

// GOOD: Debounce expensive filters (search, date ranges)
// BAD: Firing API calls on every keystroke
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}
