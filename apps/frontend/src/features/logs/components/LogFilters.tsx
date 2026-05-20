import { useState, useEffect } from 'react';
import { useDebounce } from '../hooks/useDebounce';
import { LogFilters as LogFiltersType } from '../hooks/useLogs';

interface Props {
  onFilterChange: (filters: LogFiltersType) => void;
}

export function LogFilters({ onFilterChange }: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [severity, setSeverity] = useState<'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | ''>('');

  // GOOD: Debounce search term to reduce API calls (300ms)
  // BAD: Firing API calls on every keystroke without debouncing
  const debouncedSearch = useDebounce(searchTerm, 300);

  // Update filters when debounced search changes
  useEffect(() => {
    // Always propagate severity changes.
    // Only include searchTerm when it is empty or meets the 3-char backend minimum.
    const trimmedSearch = debouncedSearch.trim();
    const effectiveSearchTerm =
      trimmedSearch.length >= 3 ? trimmedSearch : undefined;

    onFilterChange({
      searchTerm: effectiveSearchTerm,
      severity: severity || undefined,
    });
  }, [debouncedSearch, severity, onFilterChange]);

  // GOOD: Immediate severity change (no debounce needed for dropdowns)
  const handleSeverityChange = (value: string) => {
    const newSeverity = value as 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | '';
    setSeverity(newSeverity);
  };

  // Clear all filters
  const handleClear = () => {
    setSearchTerm('');
    setSeverity('');
  };

  return (
    <div className="flex flex-col gap-4 p-4 bg-white rounded-lg border-2 border-lime-400">
      <h3 className="text-lg font-semibold text-gray-800">Filters</h3>

      <div className="flex flex-col gap-2">
        {/* Severity Filter */}
        <label htmlFor="severity-filter" className="text-sm font-medium text-gray-700">
          Severity
        </label>
        <select
          id="severity-filter"
          value={severity}
          onChange={(e) => handleSeverityChange(e.target.value)}
          className="border-2 border-gray-300 rounded px-3 py-2 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-lime-500 focus:border-lime-500"
        >
          <option value="">All Severities</option>
          <option value="DEBUG">DEBUG</option>
          <option value="INFO">INFO</option>
          <option value="WARN">WARN</option>
          <option value="ERROR">ERROR</option>
        </select>
      </div>

      <div className="flex flex-col gap-2">
        {/* Search Filter */}
        <label htmlFor="search-filter" className="text-sm font-medium text-gray-700">
          Search Message
        </label>
        <input
          id="search-filter"
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search (min 3 characters)..."
          className="border-2 border-gray-300 rounded px-3 py-2 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-lime-500 focus:border-lime-500"
        />
        {searchTerm.length > 0 && searchTerm.length < 3 && (
          <p className="text-xs text-red-600">Please enter at least 3 characters</p>
        )}
      </div>

      {/* Clear Button */}
      <button
        onClick={handleClear}
        className="px-4 py-2 bg-lime-400 text-lime-900 font-medium rounded hover:bg-lime-500 transition-colors focus:outline-none focus:ring-2 focus:ring-lime-600"
      >
        Clear Filters
      </button>
    </div>
  );
}

// GOOD: Debounce expensive filters (search input with 300ms delay)
// GOOD: Immediate severity change (no debounce for dropdowns)
// BAD: Debouncing severity (unnecessary delay for user)
