import { useEffect, useMemo, useState } from 'react';
import { Search, TrendingUp, ChevronUp, ChevronDown } from 'lucide-react';
import { supabase } from '../supabase';
import { useCountry } from '../context/CountryContext';

interface ConsumptionRow {
  id: string;
  facility_id: string;
  medicine_id: string;
  quantity: number;
  period_start: string;
  period_end: string;
  recorded_at: string;
}

interface FacilityLite { id: string; name: string; country: string; district: string; }
interface MedicineLite { id: string; name: string; category: string; unit: string; }

type SortKey = 'facility' | 'medicine' | 'quantity' | 'period_start' | 'period_end';
type SortDir = 'asc' | 'desc';

export function ConsumptionPage() {
  const { country } = useCountry();
  const [consumption, setConsumption] = useState<ConsumptionRow[]>([]);
  const [facilities, setFacilities] = useState<FacilityLite[]>([]);
  const [medicines, setMedicines] = useState<MedicineLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [periodFilter, setPeriodFilter] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('period_start');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const [facRes, medRes] = await Promise.all([
        country
          ? supabase.from('facilities').select('id, name, country, district').eq('country', country)
          : supabase.from('facilities').select('id, name, country, district'),
        supabase.from('medicines').select('id, name, category, unit'),
      ]);
      const facList = (facRes.data ?? []) as FacilityLite[];
      const facMap = new Map(facList.map(f => [f.id, f]));
      const all: ConsumptionRow[] = [];
      const PAGE = 1000;
      let from = 0;
      while (true) {
        const { data } = await supabase
          .from('consumption')
          .select('id, facility_id, medicine_id, quantity, period_start, period_end, recorded_at')
          .range(from, from + PAGE - 1);
        if (!data || data.length === 0) break;
        for (const row of data) {
          if (facMap.has(row.facility_id)) all.push(row as ConsumptionRow);
        }
        if (data.length < PAGE) break;
        from += PAGE;
      }
      if (cancelled) return;
      setConsumption(all);
      setFacilities(facList);
      setMedicines((medRes.data ?? []) as MedicineLite[]);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [country]);

  const facilityMap = useMemo(() => new Map(facilities.map(f => [f.id, f])), [facilities]);
  const medicineMap = useMemo(() => new Map(medicines.map(m => [m.id, m])), [medicines]);

  const enriched = useMemo(() => {
    return consumption.map(c => {
      const fac = facilityMap.get(c.facility_id);
      const med = medicineMap.get(c.medicine_id);
      return {
        ...c,
        facilityName: fac?.name ?? '—',
        facilityDistrict: fac?.district ?? '—',
        facilityCountry: fac?.country ?? '—',
        medicineName: med?.name ?? '—',
        medicineCategory: med?.category ?? '—',
        medicineUnit: med?.unit ?? '',
      };
    });
  }, [consumption, facilityMap, medicineMap]);

  const stats = useMemo(() => {
    const total = enriched.length;
    const totalQty = enriched.reduce((s, e) => s + (e.quantity ?? 0), 0);
    const periods = new Set(enriched.map(e => e.period_start));
    return { total, totalQty, periods: periods.size };
  }, [enriched]);

  const periods = useMemo(() => {
    const set = new Set(enriched.map(e => e.period_start));
    return Array.from(set).sort().reverse();
  }, [enriched]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }

  const filtered = useMemo(() => {
    const list = enriched.filter(c => {
      if (periodFilter && c.period_start !== periodFilter) return false;
      if (!search) return true;
      const q = search.toLowerCase();
      return c.facilityName.toLowerCase().includes(q) ||
             c.medicineName.toLowerCase().includes(q) ||
             c.facilityDistrict.toLowerCase().includes(q);
    });
    const dir = sortDir === 'asc' ? 1 : -1;
    return list.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'facility': cmp = a.facilityName.localeCompare(b.facilityName); break;
        case 'medicine': cmp = a.medicineName.localeCompare(b.medicineName); break;
        case 'quantity': cmp = a.quantity - b.quantity; break;
        case 'period_start': cmp = (a.period_start ?? '').localeCompare(b.period_start ?? ''); break;
        case 'period_end': cmp = (a.period_end ?? '').localeCompare(b.period_end ?? ''); break;
      }
      return cmp * dir;
    });
  }, [enriched, search, periodFilter, sortKey, sortDir]);

  function SortHeader({ label, k, align = 'left' }: { label: string; k: SortKey; align?: 'left' | 'right' }) {
    const active = sortKey === k;
    return (
      <th
        className={`px-4 py-3 font-semibold cursor-pointer select-none hover:text-slate-800 ${align === 'right' ? 'text-right' : 'text-left'}`}
        onClick={() => toggleSort(k)}
      >
        <span className="inline-flex items-center gap-1">
          {label}
          {active && (sortDir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />)}
        </span>
      </th>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Consumption</h1>
        <p className="text-slate-500 text-sm mt-1">
          Historical medicine consumption {country ? `· ${country}` : '· All Africa'}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Total Records</span>
            <TrendingUp size={16} className="text-cyan-500" />
          </div>
          <div className="mt-2 text-3xl font-bold text-slate-900 tabular-nums">{stats.total.toLocaleString()}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Total Units Consumed</span>
            <TrendingUp size={16} className="text-green-500" />
          </div>
          <div className="mt-2 text-3xl font-bold text-green-600 tabular-nums">{stats.totalQty.toLocaleString()}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Reporting Periods</span>
            <TrendingUp size={16} className="text-indigo-500" />
          </div>
          <div className="mt-2 text-3xl font-bold text-indigo-600 tabular-nums">{stats.periods}</div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search facility, medicine or district..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-cyan-500"
          />
        </div>
        <select
          value={periodFilter}
          onChange={(e) => setPeriodFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-cyan-500"
        >
          <option value="">All periods</option>
          {periods.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
              <tr>
                <SortHeader label="Facility" k="facility" />
                <SortHeader label="Medicine" k="medicine" />
                <SortHeader label="Quantity" k="quantity" align="right" />
                <SortHeader label="Period Start" k="period_start" />
                <SortHeader label="Period End" k="period_end" />
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 500).map(c => (
                <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                  <td className="px-4 py-2">
                    <div className="font-medium text-slate-800">{c.facilityName}</div>
                    <div className="text-[11px] text-slate-400">{c.facilityDistrict} · {c.facilityCountry}</div>
                  </td>
                  <td className="px-4 py-2">
                    <div className="text-slate-700">{c.medicineName}</div>
                    <div className="text-[11px] text-slate-400">{c.medicineCategory}</div>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-slate-700">
                    {c.quantity}
                    <span className="text-[10px] text-slate-400 ml-1">{c.medicineUnit}</span>
                  </td>
                  <td className="px-4 py-2 text-slate-500 text-xs tabular-nums">{c.period_start}</td>
                  <td className="px-4 py-2 text-slate-500 text-xs tabular-nums">{c.period_end}</td>
                </tr>
              ))}
              {filtered.length === 0 && !loading && (
                <tr><td colSpan={5} className="text-center text-slate-400 py-8 text-sm">No consumption records match your filters</td></tr>
              )}
              {loading && (
                <tr><td colSpan={5} className="text-center text-slate-400 py-8 text-sm">Loading...</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {filtered.length > 500 && (
          <div className="px-4 py-2 border-t border-slate-200 bg-slate-50 text-xs text-slate-500">
            Showing first 500 of {filtered.length.toLocaleString()} records. Use search or period filter to narrow.
          </div>
        )}
      </div>
    </div>
  );
}
