import { Download, Loader2 } from 'lucide-react';

interface ReportExportButtonProps {
  onClick: () => void;
  isGenerating: boolean;
  label?: string;
}

export function ReportExportButton({ onClick, isGenerating, label = 'Export Report' }: ReportExportButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={isGenerating}
      className="inline-flex items-center gap-2 bg-white border border-slate-300 text-slate-800 rounded-md px-3 py-1.5 text-sm font-medium hover:border-cyan-500 hover:text-cyan-600 disabled:opacity-60 disabled:cursor-not-allowed transition"
    >
      {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
      {isGenerating ? 'Generating…' : label}
    </button>
  );
}
