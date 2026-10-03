import { type ReactNode } from 'react';
import { NavLink, Link } from 'react-router-dom';
import {
  Home,
  LayoutDashboard,
  Radar,
  Pill,
  Building2,
  Package,
  ShoppingCart,
  TrendingUp,
  ArrowRightLeft,
  Sparkles,
  Bell,
  Upload,
  FileText,
  Users,
  Settings,
} from 'lucide-react';
import { useCountry, type Country } from '../context/CountryContext';
import { useRole, ROLES, type RoleKey } from '../context/RoleContext';

const NAV_ITEMS = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/shortage-radar', label: 'Shortage Radar', icon: Radar },
  { to: '/medicines', label: 'Medicines', icon: Pill },
  { to: '/facilities', label: 'Facilities', icon: Building2 },
  { to: '/inventory', label: 'Inventory', icon: Package },
  { to: '/consumption', label: 'Consumption', icon: TrendingUp },
  { to: '/procurement', label: 'Procurement', icon: ShoppingCart },
  { to: '/predictions', label: 'Predictions', icon: TrendingUp },
  { to: '/redistribution', label: 'Redistribution', icon: ArrowRightLeft },
  { to: '/ai-advisor', label: 'AI Supply Advisor', icon: Sparkles },
  { to: '/alerts', label: 'Alerts', icon: Bell },
  { to: '/data-import', label: 'Data Import', icon: Upload },
  { to: '/reports', label: 'Reports', icon: FileText },
  { to: '/users', label: 'Users & Roles', icon: Users },
  { to: '/settings', label: 'Settings', icon: Settings },
];

function CountrySelector() {
  const { country, setCountry } = useCountry();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setCountry(value === '' ? null : (value as Country));
  };

  return (
    <select
      value={country ?? ''}
      onChange={handleChange}
      className="bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-md px-3 py-1.5 focus:outline-none focus:border-cyan-500"
    >
      <option value="">All Africa</option>
      <option value="Botswana">Botswana</option>
      <option value="Ghana">Ghana</option>
      <option value="Kenya">Kenya</option>
      <option value="Nigeria">Nigeria</option>
    </select>
  );
}

function RoleSelector() {
  const { role, setRole } = useRole();
  return (
    <select
      value={role}
      onChange={(e) => setRole(e.target.value as RoleKey)}
      className="bg-white border border-slate-300 text-slate-700 text-sm rounded-md px-3 py-1.5 focus:outline-none focus:border-cyan-500"
      title="Simulated role — in production this comes from the authenticated session"
    >
      {ROLES.map(r => (
        <option key={r.key} value={r.key}>Acting as: {r.label}</option>
      ))}
    </select>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col flex-shrink-0">
        <div className="h-16 flex items-center px-5 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <img src="/logo.svg" alt="Medisignal" className="w-8 h-8 rounded-lg" />
            <div>
              <div className="text-white font-semibold text-sm leading-tight">Medisignal</div>
              <div className="text-slate-500 text-[10px] uppercase tracking-wider">Africa</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-4">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-5 py-2.5 text-sm transition-colors ${
                    isActive
                      ? 'bg-slate-800 text-cyan-400 border-r-2 border-cyan-400'
                      : 'hover:bg-slate-800/50 hover:text-slate-100'
                  }`
                }
              >
                <Icon size={16} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 flex-shrink-0">
          <div className="flex items-center gap-3">
            <CountrySelector />
            <RoleSelector />
          </div>
          <div className="flex items-center gap-4">
            <span className="text-[10px] font-semibold uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-300 px-2 py-1 rounded">
              Demonstration Data
            </span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
        <footer className="h-10 bg-white border-t border-slate-200 flex items-center justify-between px-6 text-[11px] text-slate-500 flex-shrink-0">
          <div>Medisignal Africa · Demonstration Data</div>
          <div>Developed by <strong className="text-slate-700">Gabolekwe Topo Gabolekwe</strong></div>
        </footer>
      </div>
    </div>
  );
}






