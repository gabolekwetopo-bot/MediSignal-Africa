import { useEffect, useMemo, useState } from 'react';
import { FileText, Upload, Download, CheckCircle2 } from 'lucide-react';
import { supabase } from '../supabase';
import { useCountry } from '../context/CountryContext';

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

interface ReportRecord {
  id: string;
  generatedAt: string;
  country: string;
  format: string;
  summaryIncluded: boolean;
}

export function ReportsPage() {
  const { country } = useCountry();
  const [tab, setTab] = useState<Tab>('reports');
  const [imports, setImports] = useState<ImportRow[]>([]);
  const [, setLoading] = useState(true);
  const [reports, setReports] = useState<ReportRecord[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from('data_imports')
        .select('id, filename, import_type, row_count, valid_count, invalid_count, status, uploaded_by, created_at')
        .order('created_at', { ascending: false })
        .limit(50);
      if (cancelled) return;
      setImports((data ?? []) as ImportRow[]);

      // Reports history is stored in localStorage since each export is client-side
      try {
        const stored = localStorage.getItem('medisignal.report-history');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) setReports(parsed);
        }
      } catch {}
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [country]);

  const stats = useMemo(() => {
    const totalImports = imports.length;
    const totalRows = imports.reduce((s, i) => s + (i.row_count ?? 0), 0);
    const totalReports = reports.length;
    return { totalImports, totalRows, totalReports };
  }, [imports, reports]);

  function clearReportHistory() {
    if (!confirm('Clear report generation history from this browser?')) return;
    localStorage.removeItem('medisignal.report-history');
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
          History of generated situation reports and staged data imports
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
      </div>

      <div className="flex gap-2 border-b border-slate-200">
        <button
          onClick={() => setTab('reports')}
          className={`px-4 py-2 text-sm font-medium transition border-b-2 -mb-px ${
            tab === 'reports' ? 'border-cyan-500 text-cyan-700' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Situation Reports ({reports.length})
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
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          {reports.length === 0 ? (
            <div className="text-center py-12">
              <FileText size={28} className="mx-auto text-slate-300 mb-2" />
              <div className="text-sm text-slate-500">No reports generated yet</div>
              <div className="text-xs text-slate-400 mt-1">
                Generate a situation report from the Shortage Radar page.
              </div>
            </div>
          ) : (
            <>
              <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
                <div className="text-xs text-slate-500">Report history is stored locally in this browser.</div>
                <button
                  onClick={clearReportHistory}
                  className="text-[11px] text-red-600 hover:text-red-800 font-medium"
                >
                  Clear history
                </button>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="text-left px-5 py-3 font-semibold">Generated</th>
                    <th className="text-left px-5 py-3 font-semibold">Country</th>
                    <th className="text-left px-5 py-3 font-semibold">Format</th>
                    <th className="text-left px-5 py-3 font-semibold">AI Summary</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map(r => (
                    <tr key={r.id} className="border-t border-slate-100">
                      <td className="px-5 py-2.5 text-slate-700 tabular-nums text-xs">
                        {new Date(r.generatedAt).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                      <td className="px-5 py-2.5 font-medium text-slate-800">{r.country}</td>
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
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
        <strong className="text-slate-800">About this page:</strong> Medisignal produces a 6-page printable situation report
        from the Shortage Radar page. Each generation is logged here with a timestamp, the country it covers, and whether
        the AI executive summary was successfully produced. Data imports staged through the Data Import page are also
        listed for audit and traceability.
      </div>
    </div>
  );
}

