import { useEffect, useMemo, useState } from 'react';
import { Search, AlertTriangle, Clock, CheckCircle2 } from 'lucide-react';
import { supabase } from '../supabase';
import { useCountry } from '../context/CountryContext';

interface ProcurementRow {
  id: string;
  facility_id: string;
  medicine_id: string;
  order_date: string;
  expected_delivery: string | null;
  quantity_ordered: number;
  quantity_received: number;
  status: string;
}

interface FacilityLite { id: string; name: string; country: string; district: string; }
interface MedicineLite { id: string; name: string; category: string; }

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    delivered: 'bg-green-100 text-green-800 border-green-300',
    in_transit: 'bg-blue-100 text-blue-800 border-blue-300',
    approved: 'bg-indigo-100 text-indigo-800 border-indigo-300',
    pending: 'bg-slate-100 text-slate-700 border-slate-300',
    delayed: 'bg-red-100 text-red-800 border-red-300',
    cancelled: 'bg-gray-100 text-gray-500 border-gray-300',
  };
  return (
    <span className={`inline-block px-2 py-0.5 text-[10px] font-semibold border rounded uppercase tracking-wide ${styles[status] ?? styles.pending}`}>
      {status.replace('_', ' ')}
    </span>
  );
}

function daysOverdue(expected: string | null, status: string): number {
  if (!expected || status === 'delivered' || status === 'cancelled') return 0;
  const now = new Date();
  const exp = new Date(expected);
  const diff = Math.floor((now.getTime() - exp.getTime()) / 86400000);
  return diff > 0 ? diff : 0;
}

export function ProcurementPage() {
  const { country } = useCountry();
  const [procurement, setProcurement] = useState<ProcurementRow[]>([]);
  const [facilities, setFacilities] = useState<FacilityLite[]>([]);
  const [medicines, setMedicines] = useState<MedicineLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [riskOnly, setRiskOnly] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const [procRes, facRes, medRes] = await Promise.all([
        country
          ? supabase.from('procurement').select('id, facility_id, medicine_id, order_date, expected_delivery, quantity_ordered, quantity_received, status')
          : supabase.from('procurement').select('id, facility_id, medicine_id, order_date, expected_delivery, quantity_ordered, quantity_received, status'),
        country
          ? supabase.from('facilities').select('id, name, country, district').eq('country', country)
          : supabase.from('facilities').select('id, name, country, district'),
        supabase.from('medicines').select('id, name, category'),
      ]);
      if (cancelled) return;
      const facMap = new Map((facRes.data ?? []).map((f: any) => [f.id, f]));
      const filtered = (procRes.data ?? []).filter((p: any) => facMap.has(p.facility_id));
      setProcurement(filtered as ProcurementRow[]);
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
    return procurement.map(p => {
      const fac = facilityMap.get(p.facility_id);
      const med = medicineMap.get(p.medicine_id);
      const overdue = daysOverdue(p.expected_delivery, p.status);
      return {
        ...p,
        facilityName: fac?.name ?? '—',
        facilityDistrict: fac?.district ?? '—',
        facilityCountry: fac?.country ?? '—',
        medicineName: med?.name ?? '—',
        medicineCategory: med?.category ?? '—',
        daysOverdue: overdue,
        isAtRisk: overdue > 0 || p.status === 'delayed',
      };
    });
  }, [procurement, facilityMap, medicineMap]);

  const kpis = useMemo(() => {
    const delayed = enriched.filter(e => e.status === 'delayed').length;
    const inTransit = enriched.filter(e => e.status === 'in_transit').length;
    const overdueCount = enriched.filter(e => e.daysOverdue > 0).length;
    const delivered = enriched.filter(e => e.status === 'delivered').length;
    return { delayed, inTransit, overdueCount, delivered, total: enriched.length };
  }, [enriched]);

  const statuses = ['pending', 'approved', 'in_transit', 'delayed', 'delivered', 'cancelled'];

  const filtered = useMemo(() => {
    return enriched.filter(p => {
      if (statusFilter && p.status !== statusFilter) return false;
      if (riskOnly && !p.isAtRisk) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!p.facilityName.toLowerCase().includes(q) &&
            !p.medicineName.toLowerCase().includes(q) &&
            !p.facilityDistrict.toLowerCase().includes(q)) return false;
      }
      return true;
    }).sort((a, b) => {
      const overdueDiff = b.daysOverdue - a.daysOverdue;
      if (overdueDiff !== 0) return overdueDiff;
      return (a.expected_delivery ?? '').localeCompare(b.expected_delivery ?? '');
    });
  }, [enriched, statusFilter, riskOnly, search]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Procurement</h1>
        <p className="text-slate-500 text-sm mt-1">
          {kpis.total} orders tracked {country ? `· ${country}` : '· All Africa'}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Delayed Orders</span>
            <AlertTriangle size={16} className="text-red-500" />
          </div>
          <div className="mt-2 text-3xl font-bold text-slate-900 tabular-nums">{kpis.delayed}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Overdue</span>
            <Clock size={16} className="text-orange-500" />
          </div>
          <div className="mt-2 text-3xl font-bold text-slate-900 tabular-nums">{kpis.overdueCount}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">In Transit</span>
            <Clock size={16} className="text-blue-500" />
          </div>
          <div className="mt-2 text-3xl font-bold text-slate-900 tabular-nums">{kpis.inTransit}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Delivered</span>
            <CheckCircle2 size={16} className="text-green-500" />
          </div>
          <div className="mt-2 text-3xl font-bold text-slate-900 tabular-nums">{kpis.delivered}</div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search facility or medicine..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-cyan-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-cyan-500"
        >
          <option value="">All statuses</option>
          {statuses.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>
        <label className="flex items-center gap-2 px-3 py-2 text-sm border border-slate-300 rounded-md cursor-pointer hover:border-cyan-500">
          <input
            type="checkbox"
            checked={riskOnly}
            onChange={(e) => setRiskOnly(e.target.checked)}
            className="accent-red-500"
          />
          <span className="text-slate-700">At risk only</span>
        </label>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
            <tr>
              <th className="text-left px-4 py-3 font-semibold">Facility</th>
              <th className="text-left px-4 py-3 font-semibold">Medicine</th>
              <th className="text-left px-4 py-3 font-semibold">Order Date</th>
              <th className="text-left px-4 py-3 font-semibold">Expected</th>
              <th className="text-right px-4 py-3 font-semibold">Qty</th>
              <th className="text-right px-4 py-3 font-semibold">Overdue</th>
              <th className="text-left px-4 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => (
              <tr key={p.id} className={`border-t border-slate-100 hover:bg-slate-50/50 ${p.isAtRisk ? 'bg-red-50/30' : ''}`}>
                <td className="px-4 py-2">
                  <div className="font-medium text-slate-800">{p.facilityName}</div>
                  <div className="text-[11px] text-slate-400">{p.facilityDistrict} · {p.facilityCountry}</div>
                </td>
                <td className="px-4 py-2">
                  <div className="text-slate-700">{p.medicineName}</div>
                  <div className="text-[11px] text-slate-400">{p.medicineCategory}</div>
                </td>
                <td className="px-4 py-2 text-slate-500 text-xs tabular-nums">{p.order_date}</td>
                <td className="px-4 py-2 text-slate-500 text-xs tabular-nums">{p.expected_delivery ?? '—'}</td>
                <td className="px-4 py-2 text-right tabular-nums text-slate-700">{p.quantity_ordered}</td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {p.daysOverdue > 0 ? (
                    <span className="text-red-600 font-semibold">{p.daysOverdue}d</span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="px-4 py-2"><StatusBadge status={p.status} /></td>
              </tr>
            ))}
            {filtered.length === 0 && !loading && (
              <tr><td colSpan={7} className="text-center text-slate-400 py-8 text-sm">No orders match your filters</td></tr>
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

