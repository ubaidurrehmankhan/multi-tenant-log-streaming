import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface TenantStore {
  currentTenant: string | null;
  setTenant: (id: string | null) => void;
}

// GOOD: Zustand with persistence
export const useTenantStore = create<TenantStore>()(
  persist(
    (set) => ({
      currentTenant: null,
      setTenant: (id) => set({ currentTenant: id })
    }),
    { name: 'tenant-storage' }
  )
);

// GOOD: Use in components
// const { currentTenant, setTenant } = useTenantStore();
