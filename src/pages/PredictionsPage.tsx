import { useEffect, useMemo, useState } from 'react';
import { TrendingDown, Calendar, AlertTriangle, ChevronDown, ChevronRight, Building2, Pill, Printer, Loader2 } from 'lucide-react';
import { supabase } from '../supabase';
import { useCountry } from '../context/CountryContext';
import { generateForecastHTML, downloadForecastReport } from '../lib/forecastReportGenerator';

interface RadarRow {
  facility_id: string;
  facility_name: string;
  district: string;
  medicine_id: string;
  medicine_name: string;
  medicine_category: string;
  risk_level: string;
  days_of_stock: number | null;
  current_stock: number;
  projected_stockout_date: string | null;
}

interface WeekBucket {
  label: string;
  startDate: Date;
  endDate: Date;
  rows: RadarRow[];
  criticalCount: number;
  highCount: number;
  medicineNames: Set<string>;
}

const BUCKET_LABELS = ['This week', 'Next week', 'In 2 weeks', 'In 3 weeks', 'Weeks 5-6', 'Weeks 7-8', 'Weeks 9-12'];

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

export function PredictionsPage() {
  const { country } = useCountry();
  const [radar, setRadar] = useState<RadarRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedWeek, setExpandedWeek] = useState<number | null>(0);
  const [generatingWeek, setGeneratingWeek] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const { data } = await supabase.rpc('get_shortage_radar', { country_filter: country });
      if (cancelled) return;
      const filtered = (data ?? []).filter((r: any) =>
        r.projected_stockout_date && (r.risk_level === 'Critical' || r.risk_level === 'High')
      );
      setRadar(filtered as RadarRow[]);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [country]);

  const buckets = useMemo<WeekBucket[]>(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const ranges = [
      { days: 7, label: BUCKET_LABELS[0] },
      { days: 7, label: BUCKET_LABELS[1] },
      { days: 7, label: BUCKET_LABELS[2] },
      { days: 7, label: BUCKET_LABELS[3] },
      { days: 14, label: BUCKET_LABELS[4] },
      { days: 14, label: BUCKET_LABELS[5] },
      { days: 30, label: BUCKET_LABELS[6] },
    ];

    const out: WeekBucket[] = [];
    let cursor = new Date(now);

    for (const range of ranges) {
      const start = new Date(cursor);
      const end = new Date(cursor.getTime() + range.days * 86400000);
      const rows = radar.filter(r => {
        if (!r.projected_stockout_date) return false;
        const d = new Date(r.projected_stockout_date);
        return d >= start && d < end;
      });
      const criticalCount = rows.filter(r => r.risk_level === 'Critical').length;
      const highCount = rows.filter(r => r.risk_level === 'High').length;
      const medicineNames = new Set(rows.map(r => r.medicine_name));
      out.push({
        label: range.label,
        startDate: start,
        endDate: end,
        rows,
        criticalCount,
        highCount,
        medicineNames,
      });
      cursor = end;
    }

    return out;
  }, [radar]);

  const stats = useMemo(() => {
    const total = radar.length;
    const thisWeek = buckets[0]?.rows.length ?? 0;
    const thisMonth = buckets.slice(0, 4).reduce((s, b) => s + b.rows.length, 0);
    const districts = new Set(radar.map(r => r.district)).size;
    return { total, thisWeek, thisMonth, districts };
  }, [radar, buckets]);

  async function handlePrintForecast(bucketIndex: number) {
    const bucket = buckets[bucketIndex];
    if (!bucket || bucket.rows.length === 0) return;

    setGeneratingWeek(bucketIndex);

    // Try to fetch an AI narrative for this window
    let narrative = '';
    try {
      const sample = bucket.rows.slice(0, 30).map(r => ({
        facility: r.facility_name,
        district: r.district,
        medicine: r.medicine_name,
        days_left: r.days_of_stock,
        stockout_date: r.projected_stockout_date,
        risk: r.risk_level,
      }));
      const context = {
        country: country ?? 'All Africa',
        window_label: bucket.label,
        window_start: bucket.startDate.toISOString().slice(0, 10),
        window_end: bucket.endDate.toISOString().slice(0, 10),
        total_events: bucket.rows.length,
        critical: bucket.criticalCount,
        high: bucket.highCount,
        facilities_affected: new Set(bucket.rows.map(r => r.facility_id)).size,
        medicines_affected: bucket.medicineNames.size,
        sample_events: sample,
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-report-summary`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ country, forecast_context: context }),
          signal: controller.signal,
        }
      );
      clearTimeout(timeoutId);

      if (resp.ok) {
        const json = await resp.json();
        narrative = json.summary || '';
      }
    } catch {
      // Fallback: local heuristic narrative
    }

    if (!narrative) {
      narrative = `${bucket.rows.length} medicine stockout events are projected between ${formatDate(bucket.startDate)} and ${formatDate(bucket.endDate)} across ${new Set(bucket.rows.map(r => r.facility_id)).size} facilities. Of these, ${bucket.criticalCount} are classified Critical and ${bucket.highCount} are High risk. The affected medicines span ${bucket.medicineNames.size} distinct items. Supply chain managers should prioritise redistribution from facilities holding surplus stock and escalate delayed procurement orders for the medicines listed in the table that follows.`;
    }

    const html = generateForecastHTML({
      country,
      label: bucket.label,
      startDate: bucket.startDate,
      endDate: bucket.endDate,
      rows: bucket.rows,
      narrative,
    });

    downloadForecastReport(html, country, bucket.label);
    setGeneratingWeek(null);
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
          <TrendingDown size={22} className="text-cyan-500" />
          Predictions
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Projected stockout timeline over the next 90 days {country ? `· ${country}` : '· All Africa'}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Total Projected</span>
            <AlertTriangle size={16} className="text-slate-500" />
          </div>
          <div className="mt-2 text-3xl font-bold text-slate-900 tabular-nums">{stats.total}</div>
          <div className="text-[11px] text-slate-400 mt-1">stockout events · 90 days</div>
        </div>
        <div className="bg-white border border-red-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">This Week</span>
            <AlertTriangle size={16} className="text-red-500" />
          </div>
          <div className="mt-2 text-3xl font-bold text-red-600 tabular-nums">{stats.thisWeek}</div>
          <div className="text-[11px] text-slate-400 mt-1">imminent</div>
        </div>
        <div className="bg-white border border-orange-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Next 30 Days</span>
            <AlertTriangle size={16} className="text-orange-500" />
          </div>
          <div className="mt-2 text-3xl font-bold text-orange-600 tabular-nums">{stats.thisMonth}</div>
          <div className="text-[11px] text-slate-400 mt-1">require planning</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Districts Affected</span>
            <Building2 size={16} className="text-cyan-500" />
          </div>
          <div className="mt-2 text-3xl font-bold text-cyan-600 tabular-nums">{stats.districts}</div>
          <div className="text-[11px] text-slate-400 mt-1">geographic spread</div>
        </div>
      </div>

      <div className="space-y-3">
        {buckets.map((bucket, i) => {
          const isOpen = expandedWeek === i;
          const isEmpty = bucket.rows.length === 0;
          const isGenerating = generatingWeek === i;
          return (
            <div key={i} className={`bg-white border rounded-lg overflow-hidden ${isEmpty ? 'border-slate-200' : bucket.criticalCount > 0 ? 'border-red-200' : 'border-orange-200'}`}>
              <div className={`flex items-center justify-between px-5 py-4 transition ${isEmpty ? '' : 'hover:bg-slate-50'}`}>
                <button
                  onClick={() => !isEmpty && setExpandedWeek(isOpen ? null : i)}
                  className={`flex-1 flex items-center gap-3 text-left ${isEmpty ? 'cursor-default' : ''}`}
                  disabled={isEmpty}
                >
                  {!isEmpty && (isOpen ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />)}
                  <Calendar size={16} className={isEmpty ? 'text-slate-300' : 'text-cyan-500'} />
                  <div>
                    <div className={`font-semibold text-sm ${isEmpty ? 'text-slate-400' : 'text-slate-900'}`}>
                      {bucket.label}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {formatDate(bucket.startDate)} – {formatDate(bucket.endDate)}
                    </div>
                  </div>
                </button>
                <div className="flex items-center gap-4">
                  {!isEmpty && (
                    <>
                      <div className="text-right">
                        <div className="text-xs text-slate-400">Projected</div>
                        <div className="text-lg font-bold text-slate-900 tabular-nums">{bucket.rows.length}</div>
                      </div>
                      {bucket.criticalCount > 0 && (
                        <div className="text-right">
                          <div className="text-[10px] uppercase tracking-wider font-semibold text-red-600">Critical</div>
                          <div className="text-lg font-bold text-red-600 tabular-nums">{bucket.criticalCount}</div>
                        </div>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); handlePrintForecast(i); }}
                        disabled={isGenerating}
                        className="inline-flex items-center gap-1.5 bg-cyan-500 hover:bg-cyan-600 disabled:bg-slate-300 text-white rounded-md px-3 py-1.5 text-[11px] font-semibold transition"
                        title="Generate printable forecast for this window"
                      >
                        {isGenerating ? <Loader2 size={12} className="animate-spin" /> : <Printer size={12} />}
                        {isGenerating ? 'Generating…' : 'Print Forecast'}
                      </button>
                    </>
                  )}
                  {isEmpty && <span className="text-xs text-slate-400">No projected events</span>}
                </div>
              </div>

              {isOpen && !isEmpty && (
                <div className="border-t border-slate-200 bg-slate-50/50">
                  <div className="px-5 py-3 border-b border-slate-200 bg-slate-50">
                    <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">
                      Medicines at risk: <span className="text-slate-700">{bucket.medicineNames.size}</span>
                      <span className="mx-2 text-slate-300">·</span>
                      Facilities: <span className="text-slate-700">{new Set(bucket.rows.map(r => r.facility_id)).size}</span>
                    </div>
                  </div>
                  <div className="overflow-x-auto max-h-96">
                    <table className="w-full text-sm">
                      <thead className="bg-white text-[10px] uppercase tracking-wider text-slate-500 sticky top-0">
                        <tr>
                          <th className="text-left px-5 py-2 font-semibold">Facility</th>
                          <th className="text-left px-5 py-2 font-semibold">Medicine</th>
                          <th className="text-right px-5 py-2 font-semibold">Days Left</th>
                          <th className="text-left px-5 py-2 font-semibold">Stockout Date</th>
                          <th className="text-left px-5 py-2 font-semibold">Risk</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bucket.rows.slice(0, 100).map((r, j) => (
                          <tr key={j} className="border-t border-slate-100 bg-white hover:bg-slate-50">
                            <td className="px-5 py-2">
                              <div className="font-medium text-slate-800 text-xs">{r.facility_name}</div>
                              <div className="text-[10px] text-slate-400">{r.district}</div>
                            </td>
                            <td className="px-5 py-2">
                              <div className="flex items-center gap-1 text-xs text-slate-700">
                                <Pill size={10} className="text-slate-400" />
                                {r.medicine_name}
                              </div>
                              <div className="text-[10px] text-slate-400">{r.medicine_category}</div>
                            </td>
                            <td className="px-5 py-2 text-right tabular-nums text-xs">
                              <span className={r.risk_level === 'Critical' ? 'text-red-600 font-semibold' : 'text-orange-600'}>
                                {r.days_of_stock != null ? r.days_of_stock.toFixed(1) : '—'}d
                              </span>
                            </td>
                            <td className="px-5 py-2 text-slate-500 text-xs tabular-nums">{r.projected_stockout_date}</td>
                            <td className="px-5 py-2">
                              <span className={`inline-block px-2 py-0.5 text-[10px] font-semibold border rounded ${
                                r.risk_level === 'Critical'
                                  ? 'bg-red-100 text-red-800 border-red-300'
                                  : 'bg-orange-100 text-orange-800 border-orange-300'
                              }`}>
                                {r.risk_level}
                              </span>
                            </td>
                          </tr>
                        ))}
                        {bucket.rows.length > 100 && (
                          <tr><td colSpan={5} className="text-center text-xs text-slate-400 py-3 bg-white">
                            Showing first 100 of {bucket.rows.length} records
                          </td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {loading && (
          <div className="bg-white border border-slate-200 rounded-lg p-8 text-center text-slate-400 text-sm">
            Loading predictions…
          </div>
        )}
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs text-slate-600 leading-relaxed">
        <strong className="text-slate-800">How predictions work:</strong> The platform computes days-of-stock per facility-medicine pair
        from current inventory and average daily consumption. Projected stockout dates are derived directly from these values.
        Each week bucket can be exported as a focused 2-page printable report with an AI-written narrative.
      </div>
    </div>
  );
}
