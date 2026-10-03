import { useEffect, useMemo, useState } from 'react';
import { FileText, Upload, Download, CheckCircle2, Printer, TrendingDown, Sparkles, Trash2, RefreshCw, Loader2 } from 'lucide-react';
import { supabase } from '../supabase';
import { useCountry } from '../context/CountryContext';
import { getReportHistory, clearReportHistory, type ReportHistoryEntry, type ReportKind } from '../lib/reportHistory';
import { regenerateReport } from '../lib/regenerateReport';

interface ImportRow {
  id: string;
  filename: string;
  import_type: string;
  row_count: number;
  valid_count: number;
  invalid_count: number;
  status: string;
  uploaded_by: string | null;
  created_at: string;
}

type Tab = 'reports' | 'imports';

const KIND_META: Record<ReportKind, { label: string; icon: any; color: string }> = {
  situation: { label: 'Situation Report', icon: FileText, color: 'text-cyan-600 bg-cyan-50 border-cyan-200' },
  forecast: { label: 'Forecast', icon: TrendingDown, color: 'text-orange-600 bg-orange-50 border-orange-200' },
  advisory: { label: 'Advisory Briefing', icon: Sparkles, color: 'text-purple-600 bg-purple-50 border-purple-200' },
};

export function ReportsPage() {
  const { country } = useCountry();
  const [tab, setTab] = useState<Tab>('reports');
  const [imports, setImports] = useState<ImportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<ReportHistoryEntry[]>([]);
  const [kindFilter, setKindFilter] = useState<ReportKind | ''>('');
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [regenMessage, setRegenMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    function loadReports() {
      setReports(getReportHistory());
    }

    async function loadImports() {
      setLoading(true);
      const { data } = await supabase
        .from('data_imports')
        .select('id, filename, import_type, row_count, valid_count, invalid_count, status, uploaded_by, created_at')
        .order('created_at', { ascending: false })
        .limit(50);
      if (cancelled) return;
      setImports((data ?? []) as ImportRow[]);
      setLoading(false);
    }

    loadReports();
    loadImports();

    const handler = () => loadReports();
    window.addEventListener('medisignal-report-added', handler);

    return () => {
      cancelled = true;
      window.removeEventListener('medisignal-report-added', handler);
    };
  }, [country]);

  const filteredReports = useMemo(() => {
    if (!kindFilter) return reports;
    return reports.filter(r => r.kind === kindFilter);
  }, [reports, kindFilter]);

  const stats = useMemo(() => {
    const totalImports = imports.length;
    const totalRows = imports.reduce((s, i) => s + (i.row_count ?? 0), 0);
    const totalReports = reports.length;
    const byKind = {
      situation: reports.filter(r => r.kind === 'situation').length,
      forecast: reports.filter(r => r.kind === 'forecast').length,
      advisory: reports.filter(r => r.kind === 'advisory').length,
    };
    return { totalImports, totalRows, totalReports, byKind };
  }, [imports, reports]);

  async function handleRegenerate(entry: ReportHistoryEntry) {
    setRegeneratingId(entry.id);
    setRegenMessage(null);
    const result = await regenerateReport(entry);
    setRegeneratingId(null);
    if (result.ok) {
      setRegenMessage('Report regenerated and downloaded.');
      setTimeout(() => setRegenMessage(null), 4000);
    } else {
      setRegenMessage(result.error ?? 'Regeneration failed.');
      setTimeout(() => setRegenMessage(null), 6000);
    }
  }

  function handleClear() {
    if (!confirm('Clear all report generation history from this browser?')) return;
    clearReportHistory();
    setReports([]);
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
          <FileText size={22} className="text-cyan-500" />
          Reports
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          History of generated reports and staged data imports
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Reports Generated</span>
            <FileText size={16} className="text-cyan-500" />
          </div>
          <div className="mt-2 text-3xl font-bold text-slate-900 tabular-nums">{stats.totalReports}</div>
          <div className="text-[11px] text-slate-400 mt-1">in this browser session</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Data Imports</span>
            <Upload size={16} className="text-indigo-500" />
          </div>
          <div className="mt-2 text-3xl font-bold text-slate-900 tabular-nums">{stats.totalImports}</div>
          <div className="text-[11px] text-slate-400 mt-1">files staged</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Rows Imported</span>
            <Download size={16} className="text-green-500" />
          </div>
          <div className="mt-2 text-3xl font-bold text-green-600 tabular-nums">{stats.totalRows.toLocaleString()}</div>
          <div className="text-[11px] text-slate-400 mt-1">across all uploads</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">By Type</span>
            <Printer size={16} className="text-purple-500" />
          </div>
          <div className="mt-2 flex gap-3 text-xs">
            <div>
              <div className="font-bold text-cyan-600 tabular-nums">{stats.byKind.situation}</div>
              <div className="text-[9px] text-slate-400 uppercase">Situation</div>
            </div>
            <div>
              <div className="font-bold text-orange-600 tabular-nums">{stats.byKind.forecast}</div>
              <div className="text-[9px] text-slate-400 uppercase">Forecast</div>
            </div>
            <div>
              <div className="font-bold text-purple-600 tabular-nums">{stats.byKind.advisory}</div>
              <div className="text-[9px] text-slate-400 uppercase">Advisory</div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-2 border-b border-slate-200">
        <button
          onClick={() => setTab('reports')}
          className={`px-4 py-2 text-sm font-medium transition border-b-2 -mb-px ${
            tab === 'reports' ? 'border-cyan-500 text-cyan-700' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Generated Reports ({reports.length})
        </button>
        <button
          onClick={() => setTab('imports')}
          className={`px-4 py-2 text-sm font-medium transition border-b-2 -mb-px ${
            tab === 'imports' ? 'border-cyan-500 text-cyan-700' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Data Imports ({imports.length})
        </button>
      </div>

      {tab === 'reports' && (
        <>
          <div className="bg-white border border-slate-200 rounded-lg p-4 flex items-center gap-3">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500">Filter</span>
            <select
              value={kindFilter}
              onChange={(e) => setKindFilter(e.target.value as ReportKind | '')}
              className="px-3 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-cyan-500"
            >
              <option value="">All report types</option>
              <option value="situation">Situation Reports</option>
              <option value="forecast">Forecasts</option>
              <option value="advisory">Advisory Briefings</option>
            </select>
            <div className="ml-auto text-xs text-slate-500">
              {filteredReports.length} of {reports.length} reports
            </div>
            {reports.length > 0 && (
              <button
                onClick={handleClear}
                className="inline-flex items-center gap-1 text-[11px] text-red-600 hover:text-red-800 font-medium"
              >
                <Trash2 size={11} />
                Clear history
              </button>
            )}
          </div>

          {regenMessage && (
            <div className="bg-cyan-50 border border-cyan-200 text-cyan-800 text-sm p-3 rounded-lg">
              {regenMessage}
            </div>
          )}

          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            {filteredReports.length === 0 ? (
              <div className="text-center py-12">
                <FileText size={28} className="mx-auto text-slate-300 mb-2" />
                <div className="text-sm text-slate-500">
                  {reports.length === 0 ? 'No reports generated yet' : 'No reports match this filter'}
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  Generate a report from the Shortage Radar, Predictions, or AI Advisor pages.
                </div>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="text-left px-5 py-3 font-semibold">Type</th>
                    <th className="text-left px-5 py-3 font-semibold">Country</th>
                    <th className="text-left px-5 py-3 font-semibold">Window</th>
                    <th className="text-left px-5 py-3 font-semibold">Format</th>
                    <th className="text-left px-5 py-3 font-semibold">AI Content</th>
                    <th className="text-left px-5 py-3 font-semibold">Generated</th>
                    <th className="text-right px-5 py-3 font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReports.map(r => {
                    const meta = KIND_META[r.kind];
                    const Icon = meta.icon;
                    return (
                      <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                        <td className="px-5 py-2.5">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-semibold border rounded uppercase ${meta.color}`}>
                            <Icon size={10} />
                            {meta.label}
                          </span>
                        </td>
                        <td className="px-5 py-2.5 font-medium text-slate-800">{r.country}</td>
                        <td className="px-5 py-2.5 text-slate-500 text-xs">{r.window ?? '—'}</td>
                        <td className="px-5 py-2.5 text-slate-500 text-xs">{r.format}</td>
                        <td className="px-5 py-2.5">
                          {r.summaryIncluded ? (
                            <span className="inline-flex items-center gap-1 text-green-600 text-xs font-medium">
                              <CheckCircle2 size={12} /> Included
                            </span>
                          ) : (
                            <span className="text-slate-400 text-xs">Not available</span>
                          )}
                        </td>
                        <td className="px-5 py-2.5 text-slate-500 text-xs tabular-nums">
                          {new Date(r.generatedAt).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}
                        </td>
                        <td className="px-5 py-2.5 text-right">
                          <button
                            onClick={() => handleRegenerate(r)}
                            disabled={regeneratingId === r.id}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-cyan-600 hover:text-cyan-800 disabled:text-slate-400 px-2 py-1 rounded hover:bg-cyan-50 disabled:hover:bg-transparent transition"
                            title="Regenerate and re-download this report"
                          >
                            {regeneratingId === r.id ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
                            {regeneratingId === r.id ? 'Regenerating…' : 'Re-download'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {tab === 'imports' && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          {imports.length === 0 ? (
            <div className="text-center py-12">
              <Upload size={28} className="mx-auto text-slate-300 mb-2" />
              <div className="text-sm text-slate-500">No data imports yet</div>
              <div className="text-xs text-slate-400 mt-1">
                Stage a CSV or Excel upload from the Data Import page.
              </div>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="text-left px-5 py-3 font-semibold">Filename</th>
                  <th className="text-left px-5 py-3 font-semibold">Type</th>
                  <th className="text-right px-5 py-3 font-semibold">Rows</th>
                  <th className="text-right px-5 py-3 font-semibold">Valid</th>
                  <th className="text-right px-5 py-3 font-semibold">Invalid</th>
                  <th className="text-left px-5 py-3 font-semibold">Status</th>
                  <th className="text-left px-5 py-3 font-semibold">Uploaded</th>
                </tr>
              </thead>
              <tbody>
                {imports.map(r => (
                  <tr key={r.id} className="border-t border-slate-100">
                    <td className="px-5 py-2.5 font-medium text-slate-800">{r.filename}</td>
                    <td className="px-5 py-2.5 text-slate-500 text-xs capitalize">{r.import_type}</td>
                    <td className="px-5 py-2.5 text-right tabular-nums">{r.row_count}</td>
                    <td className="px-5 py-2.5 text-right tabular-nums text-green-600">{r.valid_count}</td>
                    <td className="px-5 py-2.5 text-right tabular-nums text-red-600">{r.invalid_count}</td>
                    <td className="px-5 py-2.5">
                      <span className={`inline-block px-2 py-0.5 text-[10px] font-semibold border rounded uppercase ${
                        r.status === 'completed' ? 'bg-green-100 text-green-800 border-green-300'
                        : r.status === 'partial' ? 'bg-amber-100 text-amber-800 border-amber-300'
                        : r.status === 'failed' ? 'bg-red-100 text-red-800 border-red-300'
                        : 'bg-slate-100 text-slate-700 border-slate-300'
                      }`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-5 py-2.5 text-slate-500 text-xs tabular-nums">
                      {new Date(r.created_at).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs text-slate-600 leading-relaxed">
        <strong className="text-slate-800">About this page:</strong> Medisignal produces three types of reports —
        <strong> Situation Reports</strong> from the Shortage Radar, <strong>Forecast Reports</strong> from the Predictions page,
        and <strong>Advisory Briefings</strong> from the AI Supply Advisor. Each generation is logged here with a timestamp,
        the country it covers, and whether AI content was successfully produced. In production, this history would be
        stored server-side for audit purposes rather than in browser storage.
      </div>
    </div>
  );
}

