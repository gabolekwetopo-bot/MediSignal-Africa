import { useMemo, useState } from 'react';
import { Shield, UserCog, Building2, Users as UsersIcon, Eye, ChevronRight, Check, X, Info } from 'lucide-react';

type RoleKey = 'super_admin' | 'national_admin' | 'district_manager' | 'facility_manager' | 'procurement_officer' | 'viewer';

interface RoleDefinition {
  key: RoleKey;
  label: string;
  icon: any;
  color: string;
  description: string;
  scope: string;
  permissions: {
    view_dashboard: boolean;
    view_radar: boolean;
    view_advisor: boolean;
    view_reports: boolean;
    create_reports: boolean;
    update_inventory: boolean;
    update_consumption: boolean;
    update_procurement: boolean;
    approve_transfers: boolean;
    manage_users: boolean;
    manage_settings: boolean;
    import_data: boolean;
  };
}

const PERMISSION_LABELS: Record<keyof RoleDefinition['permissions'], string> = {
  view_dashboard: 'View dashboard',
  view_radar: 'View shortage radar',
  view_advisor: 'Use AI advisor',
  view_reports: 'View reports',
  create_reports: 'Generate reports',
  update_inventory: 'Update inventory',
  update_consumption: 'Record consumption',
  update_procurement: 'Manage procurement',
  approve_transfers: 'Approve redistribution',
  manage_users: 'Manage users',
  manage_settings: 'Configure settings',
  import_data: 'Import data',
};

const ROLES: RoleDefinition[] = [
  {
    key: 'super_admin',
    label: 'Super Administrator',
    icon: Shield,
    color: 'text-red-600 bg-red-50 border-red-200',
    description: 'Full system access across all countries and facilities. Manages platform configuration and integrations.',
    scope: 'Entire platform (all countries)',
    permissions: {
      view_dashboard: true, view_radar: true, view_advisor: true,
      view_reports: true, create_reports: true,
      update_inventory: true, update_consumption: true, update_procurement: true,
      approve_transfers: true, manage_users: true, manage_settings: true, import_data: true,
    },
  },
  {
    key: 'national_admin',
    label: 'National Administrator',
    icon: UserCog,
    color: 'text-purple-600 bg-purple-50 border-purple-200',
    description: 'Manages the entire national health system — all districts, all facilities within their country.',
    scope: 'Entire country',
    permissions: {
      view_dashboard: true, view_radar: true, view_advisor: true,
      view_reports: true, create_reports: true,
      update_inventory: true, update_consumption: true, update_procurement: true,
      approve_transfers: true, manage_users: true, manage_settings: false, import_data: true,
    },
  },
  {
    key: 'district_manager',
    label: 'District Manager',
    icon: Building2,
    color: 'text-blue-600 bg-blue-50 border-blue-200',
    description: 'Oversees facilities within a single district. Reviews data, coordinates redistribution within their district.',
    scope: 'Single district',
    permissions: {
      view_dashboard: true, view_radar: true, view_advisor: true,
      view_reports: true, create_reports: true,
      update_inventory: true, update_consumption: true, update_procurement: true,
      approve_transfers: true, manage_users: false, manage_settings: false, import_data: true,
    },
  },
  {
    key: 'facility_manager',
    label: 'Facility Manager',
    icon: UsersIcon,
    color: 'text-emerald-600 bg-emerald-50 border-emerald-200',
    description: 'Responsible for stock and consumption records at a single health facility. Data entry and reporting role.',
    scope: 'Single facility',
    permissions: {
      view_dashboard: true, view_radar: true, view_advisor: true,
      view_reports: true, create_reports: true,
      update_inventory: true, update_consumption: true, update_procurement: false,
      approve_transfers: false, manage_users: false, manage_settings: false, import_data: true,
    },
  },
  {
    key: 'procurement_officer',
    label: 'Procurement Officer',
    icon: Building2,
    color: 'text-amber-600 bg-amber-50 border-amber-200',
    description: 'Manages purchase orders and deliveries nationally. Cannot modify facility stock counts directly.',
    scope: 'Entire country (procurement only)',
    permissions: {
      view_dashboard: true, view_radar: true, view_advisor: true,
      view_reports: true, create_reports: true,
      update_inventory: false, update_consumption: false, update_procurement: true,
      approve_transfers: false, manage_users: false, manage_settings: false, import_data: true,
    },
  },
  {
    key: 'viewer',
    label: 'Viewer',
    icon: Eye,
    color: 'text-slate-600 bg-slate-50 border-slate-200',
    description: 'Read-only access. Suitable for ministry officials, development partners, researchers, and auditors.',
    scope: 'Entire country (read-only)',
    permissions: {
      view_dashboard: true, view_radar: true, view_advisor: true,
      view_reports: true, create_reports: false,
      update_inventory: false, update_consumption: false, update_procurement: false,
      approve_transfers: false, manage_users: false, manage_settings: false, import_data: false,
    },
  },
];

interface DemoUser {
  name: string;
  email: string;
  role: RoleKey;
  scope: string;
  lastActive: string;
}

const DEMO_USERS: DemoUser[] = [
  { name: 'Dr. Naledi Moloi', email: 'n.moloi@health.gov.bw', role: 'national_admin', scope: 'Botswana', lastActive: '2 hours ago' },
  { name: 'Mr. Kwame Adjei', email: 'k.adjei@health.gov.gh', role: 'national_admin', scope: 'Ghana', lastActive: '15 minutes ago' },
  { name: 'Mrs. Amara Okonkwo', email: 'a.okonkwo@health.gov.ng', role: 'procurement_officer', scope: 'Nigeria (national)', lastActive: '1 day ago' },
  { name: 'Dr. Grace Wanjiru', email: 'g.wanjiru@health.go.ke', role: 'district_manager', scope: 'Nairobi County, Kenya', lastActive: '30 minutes ago' },
  { name: 'Mr. Tshepo Kgalagadi', email: 't.kgalagadi@health.gov.bw', role: 'facility_manager', scope: 'Princess Marina Hospital, Botswana', lastActive: '4 hours ago' },
  { name: 'Ms. Adjoa Mensah', email: 'a.mensah@health.gov.gh', role: 'facility_manager', scope: 'Korle Bu Teaching Hospital, Ghana', lastActive: '1 hour ago' },
  { name: 'Mr. Ibrahim Sani', email: 'i.sani@health.gov.ng', role: 'facility_manager', scope: 'Lagos University Teaching Hospital, Nigeria', lastActive: '20 minutes ago' },
  { name: 'Ms. Fatuma Abdalla', email: 'f.abdalla@health.go.ke', role: 'viewer', scope: 'Kenya (ministry)', lastActive: '3 days ago' },
];

export function UsersPage() {
  const [selectedRole, setSelectedRole] = useState<RoleKey>('national_admin');
  const [showDemoBanner, setShowDemoBanner] = useState(true);

  const selected = useMemo(() => ROLES.find(r => r.key === selectedRole)!, [selectedRole]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Users & Roles</h1>
        <p className="text-slate-500 text-sm mt-1">
          Role-based access control defines who can see and modify what across the platform.
        </p>
      </div>

      {showDemoBanner && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start justify-between gap-3">
          <div className="flex items-start gap-2 text-xs text-amber-900">
            <Info size={14} className="mt-0.5 flex-shrink-0" />
            <div>
              <strong>Demonstration environment.</strong> This page illustrates the role and permission design. In production, users authenticate via the national health authority identity provider (OAuth 2.0 / SAML), and roles are assigned by National Administrators.
            </div>
          </div>
          <button
            onClick={() => setShowDemoBanner(false)}
            className="text-amber-700 hover:text-amber-900 text-xs font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200">
            <h2 className="font-semibold text-slate-900 text-sm">Roles</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {ROLES.map(role => {
              const Icon = role.icon;
              const isSelected = role.key === selectedRole;
              return (
                <button
                  key={role.key}
                  onClick={() => setSelectedRole(role.key)}
                  className={`w-full text-left px-4 py-3 flex items-center gap-3 transition ${
                    isSelected ? 'bg-cyan-50/60' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className={`p-1.5 rounded border ${role.color}`}>
                    <Icon size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-medium ${isSelected ? 'text-cyan-700' : 'text-slate-800'}`}>
                      {role.label}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">{role.scope}</div>
                  </div>
                  <ChevronRight size={14} className={isSelected ? 'text-cyan-500' : 'text-slate-300'} />
                </button>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white border border-slate-200 rounded-lg p-5">
            <div className="flex items-start gap-3 mb-4">
              <div className={`p-2 rounded border ${selected.color}`}>
                <selected.icon size={20} />
              </div>
              <div>
                <h2 className="font-semibold text-slate-900">{selected.label}</h2>
                <p className="text-xs text-slate-500 mt-0.5">Scope: {selected.scope}</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">{selected.description}</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200">
              <h2 className="font-semibold text-slate-900 text-sm">Permissions</h2>
              <p className="text-xs text-slate-500 mt-0.5">What this role can do</p>
            </div>
            <div className="divide-y divide-slate-100">
              {(Object.keys(PERMISSION_LABELS) as (keyof typeof PERMISSION_LABELS)[]).map(permKey => {
                const has = selected.permissions[permKey];
                return (
                  <div key={permKey} className="px-5 py-2.5 flex items-center justify-between">
                    <span className="text-sm text-slate-700">{PERMISSION_LABELS[permKey]}</span>
                    {has ? (
                      <span className="inline-flex items-center gap-1 text-green-600 text-xs font-medium">
                        <Check size={14} /> Allowed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-slate-400 text-xs font-medium">
                        <X size={14} /> Restricted
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-900 text-sm">Registered Users</h2>
          <p className="text-xs text-slate-500 mt-0.5">Sample of users active across the four-country deployment</p>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
            <tr>
              <th className="text-left px-4 py-3 font-semibold">Name</th>
              <th className="text-left px-4 py-3 font-semibold">Email</th>
              <th className="text-left px-4 py-3 font-semibold">Role</th>
              <th className="text-left px-4 py-3 font-semibold">Scope</th>
              <th className="text-left px-4 py-3 font-semibold">Last Active</th>
            </tr>
          </thead>
          <tbody>
            {DEMO_USERS.map((u, i) => {
              const role = ROLES.find(r => r.key === u.role);
              return (
                <tr key={i} className="border-t border-slate-100">
                  <td className="px-4 py-2.5 font-medium text-slate-800">{u.name}</td>
                  <td className="px-4 py-2.5 text-slate-500 text-xs">{u.email}</td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-block px-2 py-0.5 text-[10px] font-semibold border rounded ${role?.color}`}>
                      {role?.label}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600 text-xs">{u.scope}</td>
                  <td className="px-4 py-2.5 text-slate-500 text-xs">{u.lastActive}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-5">
        <h2 className="font-semibold text-slate-900 text-sm mb-3">Audit and Accountability</h2>
        <p className="text-sm text-slate-600 leading-relaxed mb-3">
          Every write operation in Medisignal is logged with the user ID, timestamp, source, and the exact fields changed. This provides a complete audit trail for:
        </p>
        <ul className="text-sm text-slate-600 space-y-1.5 list-disc pl-5">
          <li>National health ministry oversight and compliance reviews</li>
          <li>Investigating discrepancies between reported and observed stock levels</li>
          <li>Certifying data quality to development partners and donors</li>
          <li>Reconstructing historical data states when questions arise</li>
        </ul>
        <p className="text-sm text-slate-600 leading-relaxed mt-3">
          The Data Import log on the <strong>Data Import</strong> page is the first component of this audit system. Manual data entry, API integrations, and configuration changes follow the same pattern.
        </p>
      </div>
    </div>
  );
}
