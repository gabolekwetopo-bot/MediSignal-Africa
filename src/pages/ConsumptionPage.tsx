import { useEffect, useState } from 'react';
import { Search, TrendingUp, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Loader2 } from 'lucide-react';
import { supabase } from '../supabase';
import { useCountry } from '../context/CountryContext';

interface AggregateRow {
  facility_name: string;
  facility_district: string;
  facility_country: string;
  medicine_name: string;
  medicine_category: string;
  medicine_unit: string;
  total_quantity: number;
  months_reported: number;
  avg_monthly: number;
}

type SortKey = 'facility' | 'medicine' | 'total_quantity' | 'avg_monthly';
type SortDir = 'asc' | 'desc';

const PAGE_SIZE = 50;

export function ConsumptionPage() {
  const { country } = useCountry();
  const [rows, setRows] = useState<AggregateRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('total_quantity');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [summary, setSummary] = useState({ totalPairs: 0, totalUnits: 0, facilities: 0, medicines: 0 });

  useEffect(() => {
    const t = setTimeout(() => { setSearchDebounced(search); setPage(0); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(0); }, [country]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_consumption_summary_paginated', {
        country_filter: country ?? null,
        search_term: searchDebounced || null,
        sort_key: sortKey,
        sort_dir: sortDir,
        page_offset: page * PAGE_SIZE,
        page_size: PAGE_SIZE,
      });

      if (cancelled) return;
      if (error || !data) {
        setRows([]);
        setTotalCount(0);
      } else {
        const items = (data.items ?? []) as AggregateRow[];
        setRows(items);
        setTotalCount(data.total_count ?? 0);
      }
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [page, country, searchDebounced, sortKey, sortDir]);

  useEffect(() => {
    let cancelled = false;
    async function loadSummary() {
      const { data } = await supabase.rpc('get_consumption_summary', {
        country_filter: country ?? null,
      });
      if (cancelled) return;
      const list = (data ?? []) as AggregateRow[];
      const totalUnits = list.reduce((s, r) => s + Number(r.total_quantity ?? 0), 0);
      const facilities = new Set(list.map(r => r.facility_name)).size;
      const medicines = new Set(list.map(r => r.medicine_name)).size;
      setSummary({ totalPairs: list.length, totalUnits, facilities, medicines });
    }
    loadSummary();
    return () => { cancelled = true; };
  }, [country]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
    setPage(0);
  }

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

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Consumption</h1>
        <p className="text-slate-500 text-sm mt-1">
          Aggregated consumption per facility-medicine pair {country ? `· ${country}` : '· All Africa'}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Facility-Meds Tracked</span>
            <TrendingUp size={16} className="text-cyan-500" />
          </div>
          <div className="mt-2 text-3xl font-bold text-slate-900 tabular-nums">{summary.totalPairs.toLocaleString()}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Total Units Consumed</span>
            <TrendingUp size={16} className="text-green-500" />
          </div>
          <div className="mt-2 text-3xl font-bold text-green-600 tabular-nums">{summary.totalUnits.toLocaleString()}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Facilities</span>
            <TrendingUp size={16} className="text-indigo-500" />
          </div>
          <div className="mt-2 text-3xl font-bold text-indigo-600 tabular-nums">{summary.facilities}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Medicines</span>
            <TrendingUp size={16} className="text-amber-500" />
          </div>
          <div className="mt-2 text-3xl font-bold text-amber-600 tabular-nums">{summary.medicines}</div>
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
                <SortHeader label="Total Consumed" k="total_quantity" align="right" />
                <SortHeader label="Avg / Month" k="avg_monthly" align="right" />
                <th className="text-right px-4 py-3 font-semibold">Months Reported</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t border-slate-100 hover:bg-slate-50/50">
                  <td className="px-4 py-2">
                    <div className="font-medium text-slate-800">{r.facility_name}</div>
                    <div className="text-[11px] text-slate-400">{r.facility_district} · {r.facility_country}</div>
                  </td>
                  <td className="px-4 py-2">
                    <div className="text-slate-700">{r.medicine_name}</div>
                    <div className="text-[11px] text-slate-400">{r.medicine_category}</div>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-slate-700">
                    {Number(r.total_quantity).toLocaleString()}
                    <span className="text-[10px] text-slate-400 ml-1">{r.medicine_unit}</span>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums font-semibold text-cyan-700">
                    {Math.round(Number(r.avg_monthly))}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-slate-500">
                    {r.months_reported}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && !loading && (
                <tr><td colSpan={5} className="text-center text-slate-400 py-8 text-sm">No consumption data matches your filters</td></tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={5} className="text-center py-8">
                    <Loader2 size={20} className="animate-spin text-cyan-500 inline" />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between bg-slate-50">
            <div className="text-xs text-slate-500">
              Page {page + 1} of {totalPages} · {totalCount.toLocaleString()} aggregates
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

