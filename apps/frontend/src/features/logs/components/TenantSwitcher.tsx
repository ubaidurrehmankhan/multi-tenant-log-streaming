import { useTenantStore } from '../../../stores/tenant.store';

export function TenantSwitcher() {
  const { currentTenant, setTenant } = useTenantStore();

  return (
    <div className="flex flex-col gap-2">
      {/* GOOD: Proper label for accessibility */}
      <label htmlFor="tenant-select" className="text-sm font-medium text-gray-700">
        Select Tenant
      </label>

      {/* GOOD: Update store on change */}
      <select
        id="tenant-select"
        onChange={(e) => setTenant(e.target.value || null)}
        value={currentTenant ?? ''}
        className="border-2 border-lime-400 rounded px-4 py-2 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-lime-500 focus:border-lime-500 hover:border-lime-500 transition-colors"
      >
        <option value="">Select tenant...</option>
        <option value="tenant_a">Tenant A</option>
        <option value="tenant_b">Tenant B</option>
        <option value="tenant_c">Tenant C</option>
      </select>

      {/* GOOD: Show selected tenant */}
      {currentTenant && (
        <p className="text-sm text-lime-700">
          Currently viewing: <span className="font-semibold">{currentTenant}</span>
        </p>
      )}
    </div>
  );
}

// GOOD: Light theme with lime accent (border-lime-400, text-lime-700)
// GOOD: Accessible with label and keyboard navigation
// GOOD: Shows current tenant as selected via value prop
