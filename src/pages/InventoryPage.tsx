import { useEffect, useState } from 'react';
import { Search, Package, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Loader2 } from 'lucide-react';
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
  facilities?: { name: string; district: string; country: string };
  medicines?: { name: string; category: string; unit: string };
}

type SortKey = 'quantity' | 'expiry_date' | 'recorded_at';
type SortDir = 'asc' | 'desc';

const PAGE_SIZE = 50;

export function InventoryPage() {
  const { country } = useCountry();
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('quantity');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [stats, setStats] = useState({ total: 0, zeroStock: 0, expiringSoon: 0 });

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { setSearchDebounced(search); setPage(0); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  // Reset page when country changes
  useEffect(() => { setPage(0); }, [country]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);

      // Fetch page with joins
      let query = supabase
        .from('inventory')
        .select(
          'id, facility_id, medicine_id, quantity, batch_number, expiry_date, recorded_at, facilities!inner(name, district, country), medicines!inner(name, category, unit)',
          { count: 'exact' }
        )
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)
        .order(sortKey === 'quantity' ? 'quantity' : sortKey === 'expiry_date' ? 'expiry_date' : 'recorded_at', { ascending: sortDir === 'asc' });

      if (country) {
        query = query.eq('facilities.country', country);
      }
      if (searchDebounced) {
        query = query.or(`batch_number.ilike.%${searchDebounced}%`);
      }

      const { data, count, error } = await query;

      if (cancelled) return;
      if (error) {
        setRows([]);
        setTotalCount(0);
      } else {
        setRows((data ?? []) as unknown as InventoryRow[]);
        setTotalCount(count ?? 0);
      }
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [page, country, searchDebounced, sortKey, sortDir]);

  // Load lightweight stats separately (count only, no full rows)
  useEffect(() => {
    let cancelled = false;
    async function loadStats() {
      const [totalRes, zeroRes, expiringRes] = await Promise.all([
        supabase.from('inventory').select('*', { count: 'exact', head: true }),
        supabase.from('inventory').select('*', { count: 'exact', head: true }).eq('quantity', 0),
        supabase.from('inventory').select('*', { count: 'exact', head: true })
          .lte('expiry_date', new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10)),
      ]);
      if (cancelled) return;
      setStats({
        total: totalRes.count ?? 0,
        zeroStock: zeroRes.count ?? 0,
        expiringSoon: expiringRes.count ?? 0,
      });
    }
    loadStats();
    return () => { cancelled = true; };
  }, []);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); setPage(0); }
  }

  function SortHeader({ label, k, align = 'right' }: { label: string; k: SortKey; align?: 'left' | 'right' }) {
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

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

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
          <div className="mt-2 text-3xl font-bold text-slate-900 tabular-nums">{stats.total.toLocaleString()}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Zero Stock</span>
            <Package size={16} className="text-red-500" />
          </div>
          <div className="mt-2 text-3xl font-bold text-red-600 tabular-nums">{stats.zeroStock.toLocaleString()}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Expiring (90 days)</span>
            <Package size={16} className="text-orange-500" />
          </div>
          <div className="mt-2 text-3xl font-bold text-orange-600 tabular-nums">{stats.expiringSoon.toLocaleString()}</div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-4">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by batch number..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-cyan-500"
          />
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Facility</th>
                <th className="text-left px-4 py-3 font-semibold">Medicine</th>
                <SortHeader label="Quantity" k="quantity" />
                <th className="text-left px-4 py-3 font-semibold">Batch</th>
                <SortHeader label="Expiry" k="expiry_date" align="left" />
                <SortHeader label="Recorded" k="recorded_at" align="left" />
              </tr>
            </thead>
            <tbody>
              {rows.map(i => {
                const fac = (i as any).facilities;
                const med = (i as any).medicines;
                return (
                  <tr key={i.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                    <td className="px-4 py-2">
                      <div className="font-medium text-slate-800">{fac?.name ?? '—'}</div>
                      <div className="text-[11px] text-slate-400">{fac?.district} · {fac?.country}</div>
                    </td>
                    <td className="px-4 py-2">
                      <div className="text-slate-700">{med?.name ?? '—'}</div>
                      <div className="text-[11px] text-slate-400">{med?.category}</div>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      <span className={i.quantity === 0 ? 'text-red-600 font-semibold' : i.quantity < 50 ? 'text-orange-600 font-semibold' : 'text-slate-700'}>
                        {i.quantity}
                      </span>
                      <span className="text-[10px] text-slate-400 ml-1">{med?.unit}</span>
                    </td>
                    <td className="px-4 py-2 text-slate-500 text-xs">{i.batch_number ?? '—'}</td>
                    <td className="px-4 py-2 text-slate-500 text-xs tabular-nums">{i.expiry_date ?? '—'}</td>
                    <td className="px-4 py-2 text-slate-500 text-xs tabular-nums">
                      {new Date(i.recorded_at).toLocaleDateString('en-GB')}
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && !loading && (
                <tr><td colSpan={6} className="text-center text-slate-400 py-8 text-sm">No records match your filters</td></tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={6} className="text-center py-8">
                    <Loader2 size={20} className="animate-spin text-cyan-500 inline" />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between bg-slate-50">
            <div className="text-xs text-slate-500">
              Page {page + 1} of {totalPages} · {totalCount.toLocaleString()} records
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs border border-slate-300 rounded-md bg-white hover:border-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={12} /> Prev
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs border border-slate-300 rounded-md bg-white hover:border-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next <ChevronRight size={12} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

