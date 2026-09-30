import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, Building2, TrendingDown, ArrowRightLeft,
  Pill, Package, ShoppingCart, Sparkles, ChevronRight,
} from 'lucide-react';
import { supabase } from '../supabase';
import { useCountry } from '../context/CountryContext';

interface RadarRow {
  facility_id: string;
  facility_name: string;
  district: string;
  medicine_id: string;
  medicine_name: string;
  risk_level: string;
  projected_stockout_date: string | null;
}

interface FacilityRow {
  country: string;
}

interface CountryCount {
  country: string;
  count: number;
}

export function DashboardPage() {
  const { country } = useCountry();
  const [radar, setRadar] = useState<RadarRow[]>([]);
  const [facilityCounts, setFacilityCounts] = useState<CountryCount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const [radarRes, facRes] = await Promise.all([
        supabase.rpc('get_shortage_radar', { country_filter: country }),
        supabase.from('facilities').select('country'),
      ]);
      if (cancelled) return;
      setRadar((radarRes.data ?? []) as RadarRow[]);

      const counts = new Map<string, number>();
      for (const f of (facRes.data ?? []) as FacilityRow[]) {
        counts.set(f.country, (counts.get(f.country) ?? 0) + 1);
      }
      setFacilityCounts(
        Array.from(counts.entries())
          .map(([country, count]) => ({ country, count }))
          .sort((a, b) => b.count - a.count)
      );
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [country]);

  const kpis = useMemo(() => {
    const criticalMedicines = new Set<string>();
    const criticalFacilities = new Set<string>();
    let stockoutsNext14 = 0;
    const now = new Date();
    const in14 = new Date(now.getTime() + 14 * 86400000);
    for (const row of radar) {
      if (row.risk_level === 'Critical') {
        criticalMedicines.add(row.medicine_id);
        criticalFacilities.add(row.facility_id);
      }
      if (row.projected_stockout_date) {
        const d = new Date(row.projected_stockout_date);
        if (d <= in14) stockoutsNext14++;
      }
    }
    return {
      criticalMedicines: criticalMedicines.size,
      criticalFacilities: criticalFacilities.size,
      stockoutsNext14,
      totalFacilities: facilityCounts.reduce((s, c) => s + c.count, 0),
      totalCountries: facilityCounts.length,
    };
  }, [radar, facilityCounts]);

  const topMedicines = useMemo(() => {
    const map = new Map<string, { name: string; facilities: Set<string>; worst: string }>();
    const rank: Record<string, number> = { Critical: 4, High: 3, Medium: 2, Low: 1 };
    for (const r of radar) {
      if (r.risk_level !== 'Critical' && r.risk_level !== 'High') continue;
      if (!map.has(r.medicine_id)) map.set(r.medicine_id, { name: r.medicine_name, facilities: new Set(), worst: 'Low' });
      const e = map.get(r.medicine_id)!;
      e.facilities.add(r.facility_id);
      if ((rank[r.risk_level] ?? 0) > (rank[e.worst] ?? 0)) e.worst = r.risk_level;
    }
    return Array.from(map.values())
      .sort((a, b) => b.facilities.size - a.facilities.size)
      .slice(0, 5);
  }, [radar]);

  const topFacilities = useMemo(() => {
    const map = new Map<string, { name: string; district: string; critical: number; criticalMedicines: Set<string> }>();
    for (const r of radar) {
      if (r.risk_level !== 'Critical') continue;
      if (!map.has(r.facility_id)) {
        map.set(r.facility_id, {
          name: r.facility_name,
          district: r.district,
          critical: 0,
          criticalMedicines: new Set(),
        });
      }
      const e = map.get(r.facility_id)!;
      e.critical++;
      e.criticalMedicines.add(r.medicine_name);
    }
    return Array.from(map.values())
      .sort((a, b) => b.critical - a.critical)
      .slice(0, 5)
      .map(f => ({ ...f, criticalMedicines: Array.from(f.criticalMedicines) }));
  }, [radar]);

  const quickLinks = [
    { to: '/shortage-radar', label: 'Shortage Radar', desc: 'Live risk map and shortages', icon: AlertTriangle, tone: 'text-red-500' },
    { to: '/ai-advisor', label: 'AI Supply Advisor', desc: 'Ask questions about the data', icon: Sparkles, tone: 'text-cyan-500' },
    { to: '/medicines', label: 'Medicines', desc: 'Browse essential medicines', icon: Pill, tone: 'text-indigo-500' },
    { to: '/facilities', label: 'Facilities', desc: 'Browse health facilities', icon: Building2, tone: 'text-emerald-500' },
    { to: '/procurement', label: 'Procurement', desc: 'Track purchase orders', icon: ShoppingCart, tone: 'text-amber-500' },
    { to: '/redistribution', label: 'Redistribution', desc: 'Surplus-to-shortage matching', icon: ArrowRightLeft, tone: 'text-purple-500' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
        <p className="text-slate-500 text-sm mt-1">
          {country ? `${country} · National supply snapshot` : 'Africa · Cross-country supply snapshot'}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Facilities Monitored</span>
            <Building2 size={16} className="text-slate-400" />
          </div>
          <div className="mt-2 text-3xl font-bold text-slate-900 tabular-nums">{kpis.totalFacilities}</div>
          <div className="text-[11px] text-slate-400 mt-1">across {kpis.totalCountries} countries</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Critical Medicines</span>
            <Pill size={16} className="text-red-500" />
          </div>
          <div className="mt-2 text-3xl font-bold text-red-600 tabular-nums">{kpis.criticalMedicines}</div>
          <div className="text-[11px] text-slate-400 mt-1">at Critical risk level</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Facilities at Risk</span>
            <AlertTriangle size={16} className="text-orange-500" />
          </div>
          <div className="mt-2 text-3xl font-bold text-orange-600 tabular-nums">{kpis.criticalFacilities}</div>
          <div className="text-[11px] text-slate-400 mt-1">with critical shortages</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Stockouts · 14 Days</span>
            <TrendingDown size={16} className="text-yellow-500" />
          </div>
          <div className="mt-2 text-3xl font-bold text-slate-900 tabular-nums">{kpis.stockoutsNext14}</div>
          <div className="text-[11px] text-slate-400 mt-1">projected events</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-lg">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900 text-sm">Top Medicines at Risk</h2>
            <Link to="/medicines?risk=Critical" className="text-xs text-cyan-600 hover:text-cyan-700 flex items-center gap-1">
              View all <ChevronRight size={12} />
            </Link>
          </div>
          <div className="divide-y divide-slate-100">
            {topMedicines.length === 0 && !loading && (
              <div className="text-center text-slate-400 py-8 text-sm">No medicines at risk</div>
            )}
            {topMedicines.map((m, i) => (
              <div key={i} className="px-5 py-3 flex items-center justify-between">
                <div className="min-w-0">
                  <div className="font-medium text-slate-800 text-sm truncate">{m.name}</div>
                  <div className="text-[11px] text-slate-400">{m.facilities.size} facilities affected</div>
                </div>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
                  m.worst === 'Critical' ? 'bg-red-100 text-red-800 border-red-300' : 'bg-orange-100 text-orange-800 border-orange-300'
                }`}>
                  {m.worst}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900 text-sm">Facilities with Most Critical Stockouts</h2>
            <Link to="/facilities?risk=Critical" className="text-xs text-cyan-600 hover:text-cyan-700 flex items-center gap-1">
              View all <ChevronRight size={12} />
            </Link>
          </div>
          <div className="divide-y divide-slate-100">
            {topFacilities.length === 0 && !loading && (
              <div className="text-center text-slate-400 py-8 text-sm">No critical facilities</div>
            )}
            {topFacilities.map((f, i) => (
              <div key={i} className="px-5 py-3 flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-slate-800 text-sm truncate">{f.name}</div>
                  <div className="text-[11px] text-slate-400 mb-1">{f.district}</div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {f.criticalMedicines.slice(0, 3).map((m, j) => (
                      <span key={j} className="text-[10px] bg-red-50 text-red-700 border border-red-200 px-1.5 py-0.5 rounded">
                        {m}
                      </span>
                    ))}
                    {f.criticalMedicines.length > 3 && (
                      <span className="text-[10px] text-slate-400 self-center">+{f.criticalMedicines.length - 3} more</span>
                    )}
                  </div>
                </div>
                <span className="text-xs font-semibold text-red-600 tabular-nums whitespace-nowrap">{f.critical} critical</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg">
        <div className="px-5 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-900 text-sm">Quick Access</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-slate-200">
          {quickLinks.map(q => {
            const Icon = q.icon;
            return (
              <Link
                key={q.to}
                to={q.to}
                className="bg-white hover:bg-slate-50 p-4 flex items-start gap-3 transition"
              >
                <Icon size={20} className={q.tone} />
                <div>
                  <div className="font-medium text-slate-800 text-sm">{q.label}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">{q.desc}</div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {facilityCounts.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <h2 className="font-semibold text-slate-900 text-sm mb-3">Coverage by Country</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {facilityCounts.map(c => (
              <div key={c.country} className="border border-slate-200 rounded p-3">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{c.country}</div>
                <div className="text-2xl font-bold text-slate-900 tabular-nums mt-1">{c.count}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">facilities</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}



