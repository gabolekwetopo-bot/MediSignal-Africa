import { createContext, useContext, useState, type ReactNode } from 'react';

export type RoleKey = 'super_admin' | 'national_admin' | 'district_manager' | 'facility_manager' | 'procurement_officer' | 'viewer';

export interface RoleInfo {
  key: RoleKey;
  label: string;
}

export const ROLES: RoleInfo[] = [
  { key: 'super_admin', label: 'Super Administrator' },
  { key: 'national_admin', label: 'National Administrator' },
  { key: 'district_manager', label: 'District Manager' },
  { key: 'facility_manager', label: 'Facility Manager' },
  { key: 'procurement_officer', label: 'Procurement Officer' },
  { key: 'viewer', label: 'Viewer' },
];

interface RoleContextValue {
  role: RoleKey;
  setRole: (r: RoleKey) => void;
}

const RoleContext = createContext<RoleContextValue>({
  role: 'national_admin',
  setRole: () => {},
});

const STORAGE_KEY = 'medisignal.role';

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<RoleKey>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && ROLES.some(r => r.key === stored)) return stored as RoleKey;
      return 'national_admin';
    } catch {
      return 'national_admin';
    }
  });

  const setRole = (r: RoleKey) => {
    setRoleState(r);
    try { localStorage.setItem(STORAGE_KEY, r); } catch {}
  };

  return (
    <RoleContext.Provider value={{ role, setRole }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  return useContext(RoleContext);
}
