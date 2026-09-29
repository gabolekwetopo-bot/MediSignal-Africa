import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { supabase } from '../supabase';
import { useCountry } from '../context/CountryContext';

interface FacilityRow {
  id: string;
  name: string;
  district: string;
  region: string;
  country: string;
  facility_type: string;
}

interface RadarRow {
  facility_id: string;
  risk_level: string;
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

export function FacilitiesPage() {
  const { country } = useCountry();
  const [facilities, setFacilities] = useState<FacilityRow[]>([]);
  const [radar, setRadar] = useState<RadarRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [riskFilter, setRiskFilter] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const [facRes, radarRes] = await Promise.all([
        country
          ? supabase.from('facilities').select('id, name, district, region, country, facility_type').eq('country', country).order('name')
          : supabase.from('facilities').select('id, name, district, region, country, facility_type').order('name'),
        supabase.rpc('get_shortage_radar', { country_filter: country }),
      ]);
      if (cancelled) return;
      setFacilities((facRes.data ?? []) as FacilityRow[]);
      setRadar((radarRes.data ?? []) as RadarRow[]);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [country]);

  const enriched = useMemo(() => {
    const rank: Record<string, number> = { Critical: 4, High: 3, Medium: 2, Low: 1 };
    return facilities.map(f => {
      const rows = radar.filter(r => r.facility_id === f.id);
      const criticalCount = rows.filter(r => r.risk_level === 'Critical').length;
      const highCount = rows.filter(r => r.risk_level === 'High').length;
      let worst = 'Low';
      for (const r of rows) {
        if ((rank[r.risk_level] ?? 0) > (rank[worst] ?? 0)) worst = r.risk_level;
      }
      return { ...f, criticalCount, highCount, worstRisk: worst };
    });
  }, [facilities, radar]);

  const facilityTypes = useMemo(() => {
    const set = new Set(enriched.map(f => f.facility_type).filter(Boolean));
    return Array.from(set).sort();
  }, [enriched]);

  const countries = useMemo(() => {
    const set = new Set(enriched.map(f => f.country).filter(Boolean));
    return Array.from(set).sort();
  }, [enriched]);

  const filtered = useMemo(() => {
    return enriched.filter(f => {
      if (search && !f.name.toLowerCase().includes(search.toLowerCase()) && !f.district.toLowerCase().includes(search.toLowerCase())) return false;
      if (countryFilter && f.country !== countryFilter) return false;
      if (typeFilter && f.facility_type !== typeFilter) return false;
      if (riskFilter && f.worstRisk !== riskFilter) return false;
      return true;
    }).sort((a, b) => {
      const rank: Record<string, number> = { Critical: 4, High: 3, Medium: 2, Low: 1 };
      return (rank[b.worstRisk] ?? 0) - (rank[a.worstRisk] ?? 0)
        || b.criticalCount - a.criticalCount
        || a.name.localeCompare(b.name);
    });
  }, [enriched, search, countryFilter, typeFilter, riskFilter]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Facilities</h1>
        <p className="text-slate-500 text-sm mt-1">
          {facilities.length} healthcare facilities {country ? `· ${country}` : '· All Africa'}
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or district..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-cyan-500"
          />
        </div>
        {!country && (
          <select
            value={countryFilter}
            onChange={(e) => setCountryFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-cyan-500"
          >
            <option value="">All countries</option>
            {countries.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-cyan-500"
        >
          <option value="">All facility types</option>
          {facilityTypes.map(t => <option key={t} value={t}>{t}</option>)}
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
              <th className="text-left px-4 py-3 font-semibold">Facility</th>
              <th className="text-left px-4 py-3 font-semibold">District</th>
              <th className="text-left px-4 py-3 font-semibold">Country</th>
              <th className="text-left px-4 py-3 font-semibold">Type</th>
              <th className="text-right px-4 py-3 font-semibold">Critical</th>
              <th className="text-right px-4 py-3 font-semibold">High</th>
              <th className="text-left px-4 py-3 font-semibold">Worst Risk</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(f => (
              <tr key={f.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                <td className="px-4 py-2 font-medium text-slate-800">{f.name}</td>
                <td className="px-4 py-2 text-slate-500">{f.district}</td>
                <td className="px-4 py-2 text-slate-500 text-xs">{f.country}</td>
                <td className="px-4 py-2 text-slate-500 text-xs">{f.facility_type}</td>
                <td className="px-4 py-2 text-right tabular-nums font-semibold text-red-600">
                  {f.criticalCount || '—'}
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-orange-600">
                  {f.highCount || '—'}
                </td>
                <td className="px-4 py-2"><RiskBadge level={f.worstRisk} /></td>
              </tr>
            ))}
            {filtered.length === 0 && !loading && (
              <tr><td colSpan={7} className="text-center text-slate-400 py-8 text-sm">No facilities match your filters</td></tr>
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
