import { useEffect, useState } from 'react';
import { Settings as SettingsIcon, Database, Server, Shield, Info, ExternalLink } from 'lucide-react';
import { supabase } from '../supabase';

interface SystemStat {
  label: string;
  value: string | number;
  source: string;
}

export function SettingsPage() {
  const [stats, setStats] = useState<SystemStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [fac, med, cons, inv, proc, redist, imports] = await Promise.all([
        supabase.from('facilities').select('*', { count: 'exact', head: true }),
        supabase.from('medicines').select('*', { count: 'exact', head: true }),
        supabase.from('consumption').select('*', { count: 'exact', head: true }),
        supabase.from('inventory').select('*', { count: 'exact', head: true }),
        supabase.from('procurement').select('*', { count: 'exact', head: true }),
        supabase.from('redistribution_requests').select('*', { count: 'exact', head: true }),
        supabase.from('data_imports').select('*', { count: 'exact', head: true }),
      ]);

      setStats([
        { label: 'Facilities', value: fac.count ?? 0, source: 'public.facilities' },
        { label: 'Medicines', value: med.count ?? 0, source: 'public.medicines' },
        { label: 'Consumption records', value: cons.count ?? 0, source: 'public.consumption' },
        { label: 'Inventory snapshots', value: inv.count ?? 0, source: 'public.inventory' },
        { label: 'Procurement orders', value: proc.count ?? 0, source: 'public.procurement' },
        { label: 'Redistribution requests', value: redist.count ?? 0, source: 'public.redistribution_requests' },
        { label: 'Data imports', value: imports.count ?? 0, source: 'public.data_imports' },
      ]);
      setLoading(false);
    }
    load();
  }, []);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const projectRef = supabaseUrl?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] ?? 'unknown';

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
          <SettingsIcon size={22} className="text-slate-500" />
          Settings
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Platform configuration and system information
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex items-center gap-2 mb-4">
            <Database size={16} className="text-cyan-500" />
            <h2 className="font-semibold text-slate-900 text-sm">Database</h2>
          </div>
          <div className="space-y-3">
            <Row label="Provider" value="Supabase (PostgreSQL)" />
            <Row label="Project reference" value={projectRef} mono />
            <Row label="Region" value="EU West (Paris)" />
            <Row label="Access control" value="Row Level Security (RLS)" />
            <Row label="Realtime" value="Disabled for this demo" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex items-center gap-2 mb-4">
            <Server size={16} className="text-cyan-500" />
            <h2 className="font-semibold text-slate-900 text-sm">Application</h2>
          </div>
          <div className="space-y-3">
            <Row label="Framework" value="React 18 + TypeScript + Vite" />
            <Row label="Styling" value="Tailwind CSS" />
            <Row label="Charts and map" value="Leaflet + Stadia Maps" />
            <Row label="Hosting" value="Vercel" />
            <Row label="Live URL" value="medi-signal-africa.vercel.app" mono />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex items-center gap-2 mb-4">
            <Shield size={16} className="text-cyan-500" />
            <h2 className="font-semibold text-slate-900 text-sm">AI Providers</h2>
          </div>
          <div className="space-y-3">
            <Row label="Primary" value="Groq — GPT-OSS 120B" />
            <Row label="Fallback" value="Gemini 3.8 Flash" />
            <Row label="Edge functions" value="2 deployed on Supabase" />
            <Row label="Grounding" value="Live database context only" />
            <Row label="Decision mode" value="Human-in-the-loop" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex items-center gap-2 mb-4">
            <Info size={16} className="text-cyan-500" />
            <h2 className="font-semibold text-slate-900 text-sm">Data Disclaimer</h2>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            All data shown in this platform is <strong>synthetic demonstration data</strong> created for
            supply chain modelling, predictive analytics and software evaluation. It does not represent
            official records from any government or ministry of health.
          </p>
          <p className="text-xs text-slate-600 leading-relaxed mt-2">
            The platform architecture is designed for live integration with national LMIS systems
            (OpenLMIS, mSupply, custom platforms) once data-sharing agreements are in place.
          </p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-900 text-sm">System Data</h2>
          <p className="text-xs text-slate-500 mt-0.5">Live record counts from the demonstration database</p>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
            <tr>
              <th className="text-left px-5 py-3 font-semibold">Entity</th>
              <th className="text-left px-5 py-3 font-semibold">Source Table</th>
              <th className="text-right px-5 py-3 font-semibold">Records</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((s, i) => (
              <tr key={i} className="border-t border-slate-100">
                <td className="px-5 py-2.5 font-medium text-slate-800">{s.label}</td>
                <td className="px-5 py-2.5 text-slate-500 text-xs font-mono">{s.source}</td>
                <td className="px-5 py-2.5 text-right tabular-nums text-slate-700">
                  {loading ? '—' : s.value.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-5">
        <h2 className="font-semibold text-slate-900 text-sm mb-3">About Medisignal Africa</h2>
        <p className="text-xs text-slate-600 leading-relaxed">
          Medisignal Africa is an AI-powered medicine supply chain early-warning and intelligence platform.
          It sits above existing Logistics Management Information Systems (LMIS) as an intelligence layer,
          converting stock, consumption and procurement data into predictions, alerts and recommended actions.
        </p>
        <div className="mt-4 flex flex-wrap gap-3 text-xs">
          <a
            href="https://github.com/gabolekwetopo-bot/MediSignal-Africa"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-cyan-600 hover:text-cyan-700"
          >
            <ExternalLink size={12} />
            GitHub repository
          </a>
          <a
            href="https://medi-signal-africa.vercel.app"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-cyan-600 hover:text-cyan-700"
          >
            <ExternalLink size={12} />
            Live demo
          </a>
        </div>
        <div className="mt-4 pt-4 border-t border-slate-200 text-[11px] text-slate-500">
          Developed by <strong className="text-slate-700">Gabolekwe Topo Gabolekwe</strong> · Botswana · 2026
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string | number; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-slate-500 text-xs">{label}</span>
      <span className={`text-slate-800 text-right ${mono ? 'font-mono text-[11px]' : ''}`}>{value}</span>
    </div>
  );
}
