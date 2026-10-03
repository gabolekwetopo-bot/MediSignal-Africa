import { useEffect, useMemo, useState } from 'react';
import { Search, Package, ChevronUp, ChevronDown } from 'lucide-react';
import { supabase } from '../supabase';
import { useCountry } from '../context/CountryContext';

interface InventoryRow {
  id: string;
  facility_id: string;
  medicine_id: string;
  quantity: number;
  batch_number: string | null;
  expiry_date: string | null;
  recorded_at: string;
}

interface FacilityLite { id: string; name: string; country: string; district: string; }
interface MedicineLite { id: string; name: string; category: string; unit: string; }

type SortKey = 'facility' | 'medicine' | 'quantity' | 'expiry_date' | 'recorded_at';
type SortDir = 'asc' | 'desc';

export function InventoryPage() {
  const { country } = useCountry();
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [facilities, setFacilities] = useState<FacilityLite[]>([]);
  const [medicines, setMedicines] = useState<MedicineLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('quantity');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const [invRes, facRes, medRes] = await Promise.all([
        (async () => {
          const all: any[] = [];
          const PAGE = 1000;
          let from = 0;
          while (true) {
            const { data, error } = await supabase
              .from('inventory')
              .select('id, facility_id, medicine_id, quantity, batch_number, expiry_date, recorded_at')
              .range(from, from + PAGE - 1);
            if (error) return { data: all, error };
            if (!data || data.length === 0) break;
            all.push(...data);
            if (data.length < PAGE) break;
            from += PAGE;
          }
          return { data: all, error: null };
        })(),
        country
          ? supabase.from('facilities').select('id, name, country, district').eq('country', country)
          : supabase.from('facilities').select('id, name, country, district'),
        supabase.from('medicines').select('id, name, category, unit'),
      ]);
      if (cancelled) return;
      const facMap = new Map((facRes.data ?? []).map((f: any) => [f.id, f]));
      const filtered = (invRes.data ?? []).filter((i: any) => facMap.has(i.facility_id));
      setInventory(filtered as InventoryRow[]);
      setFacilities((facRes.data ?? []) as FacilityLite[]);
      setMedicines((medRes.data ?? []) as MedicineLite[]);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [country]);

  const facilityMap = useMemo(() => new Map(facilities.map(f => [f.id, f])), [facilities]);
  const medicineMap = useMemo(() => new Map(medicines.map(m => [m.id, m])), [medicines]);

  const enriched = useMemo(() => {
    return inventory.map(i => {
      const fac = facilityMap.get(i.facility_id);
      const med = medicineMap.get(i.medicine_id);
      return {
        ...i,
        facilityName: fac?.name ?? '—',
        facilityDistrict: fac?.district ?? '—',
        facilityCountry: fac?.country ?? '—',
        medicineName: med?.name ?? '—',
        medicineCategory: med?.category ?? '—',
        medicineUnit: med?.unit ?? '',
      };
    });
  }, [inventory, facilityMap, medicineMap]);

  const stats = useMemo(() => {
    const total = enriched.length;
    const zeroStock = enriched.filter(e => e.quantity === 0).length;
    const expiringSoon = enriched.filter(e => {
      if (!e.expiry_date) return false;
      const d = new Date(e.expiry_date);
      const in90 = new Date(Date.now() + 90 * 86400000);
      return d <= in90;
    }).length;
    return { total, zeroStock, expiringSoon };
  }, [enriched]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }

  const filtered = useMemo(() => {
    const list = enriched.filter(i => {
      if (!search) return true;
      const q = search.toLowerCase();
      return i.facilityName.toLowerCase().includes(q) ||
             i.medicineName.toLowerCase().includes(q) ||
             i.facilityDistrict.toLowerCase().includes(q);
    });
    const dir = sortDir === 'asc' ? 1 : -1;
    return list.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'facility': cmp = a.facilityName.localeCompare(b.facilityName); break;
        case 'medicine': cmp = a.medicineName.localeCompare(b.medicineName); break;
        case 'quantity': cmp = a.quantity - b.quantity; break;
        case 'expiry_date': cmp = (a.expiry_date ?? '').localeCompare(b.expiry_date ?? ''); break;
        case 'recorded_at': cmp = (a.recorded_at ?? '').localeCompare(b.recorded_at ?? ''); break;
      }
      return cmp * dir;
    });
  }, [enriched, search, sortKey, sortDir]);

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
        <h1 className="text-2xl font-semibold text-slate-900">Inventory</h1>
        <p className="text-slate-500 text-sm mt-1">
          Current stock snapshots {country ? `· ${country}` : '· All Africa'}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Total Records</span>
            <Package size={16} className="text-cyan-500" />
          </div>
          <div className="mt-2 text-3xl font-bold text-slate-900 tabular-nums">{stats.total}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Zero Stock</span>
            <Package size={16} className="text-red-500" />
          </div>
          <div className="mt-2 text-3xl font-bold text-red-600 tabular-nums">{stats.zeroStock}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Expiring (90 days)</span>
            <Package size={16} className="text-orange-500" />
          </div>
          <div className="mt-2 text-3xl font-bold text-orange-600 tabular-nums">{stats.expiringSoon}</div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-4">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search facility, medicine or district..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-cyan-500"
          />
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
              <tr>
                <SortHeader label="Facility" k="facility" />
                <SortHeader label="Medicine" k="medicine" />
                <SortHeader label="Quantity" k="quantity" align="right" />
                <th className="text-left px-4 py-3 font-semibold">Batch</th>
                <SortHeader label="Expiry" k="expiry_date" />
                <SortHeader label="Recorded" k="recorded_at" />
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 500).map(i => (
                <tr key={i.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                  <td className="px-4 py-2">
                    <div className="font-medium text-slate-800">{i.facilityName}</div>
                    <div className="text-[11px] text-slate-400">{i.facilityDistrict} · {i.facilityCountry}</div>
                  </td>
                  <td className="px-4 py-2">
                    <div className="text-slate-700">{i.medicineName}</div>
                    <div className="text-[11px] text-slate-400">{i.medicineCategory}</div>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    <span className={i.quantity === 0 ? 'text-red-600 font-semibold' : i.quantity < 50 ? 'text-orange-600 font-semibold' : 'text-slate-700'}>
                      {i.quantity}
                    </span>
                    <span className="text-[10px] text-slate-400 ml-1">{i.medicineUnit}</span>
                  </td>
                  <td className="px-4 py-2 text-slate-500 text-xs">{i.batch_number ?? '—'}</td>
                  <td className="px-4 py-2 text-slate-500 text-xs tabular-nums">{i.expiry_date ?? '—'}</td>
                  <td className="px-4 py-2 text-slate-500 text-xs tabular-nums">
                    {new Date(i.recorded_at).toLocaleDateString('en-GB')}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && !loading && (
                <tr><td colSpan={6} className="text-center text-slate-400 py-8 text-sm">No inventory records match your filters</td></tr>
              )}
              {loading && (
                <tr><td colSpan={6} className="text-center text-slate-400 py-8 text-sm">Loading...</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {filtered.length > 500 && (
          <div className="px-4 py-2 border-t border-slate-200 bg-slate-50 text-xs text-slate-500">
            Showing first 500 of {filtered.length} records. Use search to narrow results.
          </div>
        )}
      </div>
    </div>
  );
}


