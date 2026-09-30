import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, ChevronRight, ChevronDown, MapPin } from 'lucide-react';
import { supabase } from '../supabase';
import { useCountry } from '../context/CountryContext';

interface MedicineRow {
  id: string;
  name: string;
  category: string;
  unit: string;
  min_reorder_level: number;
}

interface RadarRow {
  medicine_id: string;
  facility_id: string;
  facility_name: string;
  district: string;
  region: string;
  risk_level: string;
  days_of_stock: number | null;
  projected_stockout_date: string | null;
  current_stock: number;
}

function RiskBadge({ level }: { level: string }) {
  const styles: Record<string, string> = {
    Critical: 'bg-red-100 text-red-800 border-red-300',
    High: 'bg-orange-100 text-orange-800 border-orange-300',
    Medium: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    Low: 'bg-green-100 text-green-800 border-green-300',
    'Insufficient Data': 'bg-slate-100 text-slate-600 border-slate-300',
  };
  return (
    <span className={`inline-block px-2 py-0.5 text-[11px] font-semibold border rounded ${styles[level] ?? styles['Insufficient Data']}`}>
      {level}
    </span>
  );
}

export function MedicinesPage() {
  const { country } = useCountry();
  const [searchParams] = useSearchParams();
  const [medicines, setMedicines] = useState<MedicineRow[]>([]);
  const [radar, setRadar] = useState<RadarRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [riskFilter, setRiskFilter] = useState(searchParams.get('risk') ?? '');
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const [medRes, radarRes] = await Promise.all([
        supabase.from('medicines').select('id, name, category, unit, min_reorder_level').order('name'),
        supabase.rpc('get_shortage_radar', { country_filter: country }),
      ]);
      if (cancelled) return;
      setMedicines((medRes.data ?? []) as MedicineRow[]);
      setRadar((radarRes.data ?? []) as RadarRow[]);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [country]);

  const enriched = useMemo(() => {
    const rank: Record<string, number> = { Critical: 4, High: 3, Medium: 2, Low: 1 };
    return medicines.map(m => {
      const rows = radar.filter(r => r.medicine_id === m.id);
      const atRiskRows = rows.filter(r => r.risk_level === 'Critical' || r.risk_level === 'High');
      let worst = 'Low';
      for (const r of rows) {
        if ((rank[r.risk_level] ?? 0) > (rank[worst] ?? 0)) worst = r.risk_level;
      }
      return {
        ...m,
        facilitiesAtRisk: atRiskRows.length,
        worstRisk: worst,
        affectedRows: atRiskRows.sort((a, b) => {
          const diff = (rank[b.risk_level] ?? 0) - (rank[a.risk_level] ?? 0);
          if (diff !== 0) return diff;
          return (a.days_of_stock ?? 999) - (b.days_of_stock ?? 999);
        }),
      };
    });
  }, [medicines, radar]);

  const categories = useMemo(() => {
    const set = new Set(enriched.map(m => m.category).filter(Boolean));
    return Array.from(set).sort();
  }, [enriched]);

  const filtered = useMemo(() => {
    return enriched.filter(m => {
      if (search && !m.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (categoryFilter && m.category !== categoryFilter) return false;
      if (riskFilter && m.worstRisk !== riskFilter) return false;
      return true;
    }).sort((a, b) => {
      const rank: Record<string, number> = { Critical: 4, High: 3, Medium: 2, Low: 1 };
      return (rank[b.worstRisk] ?? 0) - (rank[a.worstRisk] ?? 0)
        || b.facilitiesAtRisk - a.facilitiesAtRisk
        || a.name.localeCompare(b.name);
    });
  }, [enriched, search, categoryFilter, riskFilter]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Medicines</h1>
        <p className="text-slate-500 text-sm mt-1">
          {medicines.length} essential medicines tracked {country ? `· ${country}` : '· All Africa'}
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search medicines..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-cyan-500"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-cyan-500"
        >
          <option value="">All categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          value={riskFilter}
          onChange={(e) => setRiskFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-cyan-500"
        >
          <option value="">All risk levels</option>
          <option value="Critical">Critical</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
            <tr>
              <th className="text-left px-4 py-3 font-semibold w-8"></th>
              <th className="text-left px-4 py-3 font-semibold">Medicine</th>
              <th className="text-left px-4 py-3 font-semibold">Category</th>
              <th className="text-left px-4 py-3 font-semibold">Unit</th>
              <th className="text-right px-4 py-3 font-semibold">Facilities at Risk</th>
              <th className="text-right px-4 py-3 font-semibold">Reorder Level</th>
              <th className="text-left px-4 py-3 font-semibold">Worst Risk</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(m => {
              const isOpen = expanded === m.id;
              const hasAffected = m.affectedRows.length > 0;
              return (
                <>
                  <tr
                    key={m.id}
                    className={`border-t border-slate-100 ${hasAffected ? 'cursor-pointer hover:bg-slate-50/70' : ''}`}
                    onClick={() => hasAffected && setExpanded(isOpen ? null : m.id)}
                  >
                    <td className="px-4 py-2 text-slate-400">
                      {hasAffected && (isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />)}
                    </td>
                    <td className="px-4 py-2 font-medium text-slate-800">{m.name}</td>
                    <td className="px-4 py-2 text-slate-500">{m.category}</td>
                    <td className="px-4 py-2 text-slate-500 text-xs">{m.unit}</td>
                    <td className="px-4 py-2 text-right tabular-nums font-semibold">
                      {hasAffected ? (
                        <span className="text-cyan-700 underline decoration-dotted underline-offset-2">
                          {m.facilitiesAtRisk}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-slate-500">{m.min_reorder_level}</td>
                    <td className="px-4 py-2"><RiskBadge level={m.worstRisk} /></td>
                  </tr>
                  {isOpen && (
                    <tr key={`${m.id}-expanded`} className="bg-slate-50/60">
                      <td colSpan={7} className="px-4 py-3 border-t border-slate-200">
                        <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 mb-2 flex items-center gap-1">
                          <MapPin size={11} /> Facilities at risk ({m.affectedRows.length})
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                          {m.affectedRows.map(r => (
                            <div key={r.facility_id} className="bg-white border border-slate-200 rounded px-3 py-2 flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="text-xs font-medium text-slate-800 truncate">{r.facility_name}</div>
                                <div className="text-[10px] text-slate-500">{r.district}{r.region ? ` · ${r.region}` : ''}</div>
                                <div className="text-[10px] text-slate-400 mt-0.5">
                                  {r.days_of_stock != null ? `${r.days_of_stock.toFixed(1)} days of stock` : 'No stock data'}
                                </div>
                              </div>
                              <RiskBadge level={r.risk_level} />
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
            {filtered.length === 0 && !loading && (
              <tr><td colSpan={7} className="text-center text-slate-400 py-8 text-sm">No medicines match your filters</td></tr>
            )}
            {loading && (
              <tr><td colSpan={7} className="text-center text-slate-400 py-8 text-sm">Loading...</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
