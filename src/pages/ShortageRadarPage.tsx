import { useMemo, useState } from 'react';
import { AlertTriangle, TrendingDown, ArrowRightLeft, Building2 } from 'lucide-react';
import { useShortageRadar } from '../hooks/useShortageRadar';
import { useCountry } from '../context/CountryContext';
import { MapPanel } from '../components/MapPanel';
import { ReportExportButton } from '../components/ReportExportButton';
import { generateReportHTML, downloadReport } from '../lib/reportGenerator';
import { addReportHistory } from '../lib/reportHistory';
import { supabase } from '../supabase';
import type { RiskLevel } from '../types';

function RiskBadge({ level }: { level: RiskLevel | string }) {
  const styles: Record<string, string> = {
    Critical: 'bg-red-100 text-red-800 border-red-300',
    High: 'bg-orange-100 text-orange-800 border-orange-300',
    Medium: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    Low: 'bg-green-100 text-green-800 border-green-300',
    'Insufficient Data': 'bg-slate-100 text-slate-600 border-slate-300',
  };
  const cls = styles[level] ?? styles['Insufficient Data'];
  return (
    <span className={`inline-block px-2 py-0.5 text-[11px] font-semibold border rounded ${cls}`}>
      {level}
    </span>
  );
}

function KpiCard({ label, value, icon: Icon, tone }: { label: string; value: number; icon: any; tone: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</span>
        <Icon size={16} className={tone} />
      </div>
      <div className="mt-2 text-3xl font-bold text-slate-900 tabular-nums">{value}</div>
    </div>
  );
}

export function ShortageRadarPage() {
  const { data, facilities, loading, error } = useShortageRadar();
  const { country } = useCountry();
  const [isExporting, setIsExporting] = useState(false);

  const kpis = useMemo(() => {
    const criticalMedicines = new Set<string>();
    const criticalFacilities = new Set<string>();
    let stockoutsNext14 = 0;
    const today = new Date();
    const in14 = new Date(today.getTime() + 14 * 86400000);

    for (const row of data) {
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
      redistribution: 0,
    };
  }, [data]);

  const medicinesAtRisk = useMemo(() => {
    const map = new Map<string, { name: string; category: string; facilities: Set<string>; earliest: string | null; worst: string }>();
    const rank: Record<string, number> = { Critical: 4, High: 3, Medium: 2, Low: 1 };
    for (const row of data) {
      if (!map.has(row.medicine_id)) {
        map.set(row.medicine_id, { name: row.medicine_name, category: row.medicine_category, facilities: new Set(), earliest: null, worst: 'Low' });
      }
      const e = map.get(row.medicine_id)!;
      if (row.risk_level === 'Critical' || row.risk_level === 'High') e.facilities.add(row.facility_id);
      if (row.projected_stockout_date && (!e.earliest || row.projected_stockout_date < e.earliest)) e.earliest = row.projected_stockout_date;
      if ((rank[row.risk_level] ?? 0) > (rank[e.worst] ?? 0)) e.worst = row.risk_level;
    }
    return Array.from(map.values())
      .filter(m => m.worst === 'Critical' || m.worst === 'High')
      .sort((a, b) => (rank[b.worst] - rank[a.worst]) || (b.facilities.size - a.facilities.size))
      .slice(0, 10);
  }, [data]);

  const facilitiesAtRisk = useMemo(() => {
    const map = new Map<string, { name: string; district: string; critical: number; high: number; worst: string }>();
    const rank: Record<string, number> = { Critical: 4, High: 3, Medium: 2, Low: 1 };
    for (const row of data) {
      if (!map.has(row.facility_id)) {
        map.set(row.facility_id, { name: row.facility_name, district: row.district, critical: 0, high: 0, worst: 'Low' });
      }
      const e = map.get(row.facility_id)!;
      if (row.risk_level === 'Critical') e.critical++;
      if (row.risk_level === 'High') e.high++;
      if ((rank[row.risk_level] ?? 0) > (rank[e.worst] ?? 0)) e.worst = row.risk_level;
    }
    return Array.from(map.values())
      .filter(f => f.critical > 0 || f.high > 0)
      .sort((a, b) => (b.critical - a.critical) || (b.high - a.high))
      .slice(0, 10);
  }, [data]);

  const hotspots = useMemo(() => {
    const map = new Map<string, { facilities: Set<string>; medicines: Set<string> }>();
    for (const row of data) {
      if (row.risk_level !== 'Critical' && row.risk_level !== 'High') continue;
      if (!map.has(row.district)) map.set(row.district, { facilities: new Set(), medicines: new Set() });
      const e = map.get(row.district)!;
      e.facilities.add(row.facility_id);
      e.medicines.add(row.medicine_name);
    }
    return Array.from(map.entries())
      .map(([district, v]) => ({ district, facilities: v.facilities.size, medicines: Array.from(v.medicines) }))
      .sort((a, b) => b.facilities - a.facilities)
      .slice(0, 10);
  }, [data]);

  async function handleExport() {
    setIsExporting(true);
    try {
      let summary = '';
      let summaryError: string | undefined;

      // Fetch AI summary
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 25000);
        const resp = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-report-summary`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ country }),
            signal: controller.signal,
          }
        );
        clearTimeout(timeoutId);
        if (resp.ok) {
          const json = await resp.json();
          summary = json.summary || '';
          if (!summary) summaryError = 'Summary returned empty.';
        } else {
          summaryError = `Summary service returned HTTP ${resp.status}.`;
        }
      } catch (err) {
        summaryError = err instanceof Error && err.name === 'AbortError'
          ? 'Summary generation timed out.'
          : 'Summary generation failed.';
      }

      // Fetch supply context
      let supplyContext: any = null;
      try {
        const { data: ctx } = await supabase.rpc('get_supply_context', { country_filter: country });
        supplyContext = ctx;
      } catch {}

      const html = generateReportHTML({
        country,
        radarData: data,
        facilities,
        supplyContext,
        summary,
        summaryError,
      });

      downloadReport(html, country);

      // Log report generation to history
      addReportHistory({
        kind: 'situation',
        label: 'Situation Report',
        country: country ?? 'All Africa',
        format: 'HTML → PDF',
        summaryIncluded: !!summary,
        payload: {},
      });
    } catch (err) {
      console.error('Export failed:', err);
      alert('Export failed. See console for details.');
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Shortage Radar</h1>
          <p className="text-slate-500 text-sm mt-1">
            {country ? `${country} · Live risk telemetry` : 'All Africa · Aggregate view'}
            {loading && ' · loading...'}
          </p>
        </div>
        <ReportExportButton onClick={handleExport} isGenerating={isExporting} />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 text-sm p-3 rounded">
          Failed to load radar data: {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Critical Medicines" value={kpis.criticalMedicines} icon={AlertTriangle} tone="text-red-500" />
        <KpiCard label="Critical Facilities" value={kpis.criticalFacilities} icon={Building2} tone="text-orange-500" />
        <KpiCard label="Stockouts · Next 14 Days" value={kpis.stockoutsNext14} icon={TrendingDown} tone="text-yellow-500" />
        <KpiCard label="Redistribution Ops" value={kpis.redistribution} icon={ArrowRightLeft} tone="text-cyan-500" />
      </div>

      <MapPanel radarData={data} facilities={facilities} country={country} loading={loading} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-lg">
          <div className="px-4 py-3 border-b border-slate-200">
            <h2 className="font-semibold text-slate-900 text-sm">Medicines at Risk</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="text-left px-4 py-2 font-semibold">Medicine</th>
                  <th className="text-left px-4 py-2 font-semibold">Category</th>
                  <th className="text-right px-4 py-2 font-semibold">Facilities</th>
                  <th className="text-left px-4 py-2 font-semibold">Earliest</th>
                  <th className="text-left px-4 py-2 font-semibold">Risk</th>
                </tr>
              </thead>
              <tbody>
                {medicinesAtRisk.map((m, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="px-4 py-2 font-medium text-slate-800">{m.name}</td>
                    <td className="px-4 py-2 text-slate-500">{m.category}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{m.facilities.size}</td>
                    <td className="px-4 py-2 text-slate-500 text-xs">{m.earliest ?? '—'}</td>
                    <td className="px-4 py-2"><RiskBadge level={m.worst} /></td>
                  </tr>
                ))}
                {medicinesAtRisk.length === 0 && !loading && (
                  <tr><td colSpan={5} className="text-center text-slate-400 py-6 text-sm">No critical or high-risk medicines</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg">
          <div className="px-4 py-3 border-b border-slate-200">
            <h2 className="font-semibold text-slate-900 text-sm">Facilities at Risk</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="text-left px-4 py-2 font-semibold">Facility</th>
                  <th className="text-left px-4 py-2 font-semibold">District</th>
                  <th className="text-right px-4 py-2 font-semibold">Critical</th>
                  <th className="text-right px-4 py-2 font-semibold">High</th>
                  <th className="text-left px-4 py-2 font-semibold">Risk</th>
                </tr>
              </thead>
              <tbody>
                {facilitiesAtRisk.map((f, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="px-4 py-2 font-medium text-slate-800">{f.name}</td>
                    <td className="px-4 py-2 text-slate-500">{f.district}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-red-600 font-semibold">{f.critical}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-orange-600">{f.high}</td>
                    <td className="px-4 py-2"><RiskBadge level={f.worst} /></td>
                  </tr>
                ))}
                {facilitiesAtRisk.length === 0 && !loading && (
                  <tr><td colSpan={5} className="text-center text-slate-400 py-6 text-sm">No facilities at critical or high risk</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg lg:col-span-2">
          <div className="px-4 py-3 border-b border-slate-200">
            <h2 className="font-semibold text-slate-900 text-sm">Emerging Hotspots</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="text-left px-4 py-2 font-semibold">District</th>
                  <th className="text-right px-4 py-2 font-semibold">At-Risk Facilities</th>
                  <th className="text-left px-4 py-2 font-semibold">Medicines Affected</th>
                </tr>
              </thead>
              <tbody>
                {hotspots.map((h, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="px-4 py-2 font-medium text-slate-800">{h.district}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{h.facilities}</td>
                    <td className="px-4 py-2 text-slate-500 text-xs">{h.medicines.slice(0, 4).join(', ')}{h.medicines.length > 4 ? '…' : ''}</td>
                  </tr>
                ))}
                {hotspots.length === 0 && !loading && (
                  <tr><td colSpan={3} className="text-center text-slate-400 py-6 text-sm">No emerging hotspots</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}



