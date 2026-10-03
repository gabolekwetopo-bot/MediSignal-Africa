import { Link } from 'react-router-dom';
import {
  ArrowRight, Radar, Sparkles, FileText, ArrowRightLeft,
  AlertTriangle, Bell, TrendingUp, MapPin, ExternalLink,
} from 'lucide-react';

export function HeroPage() {
  const features = [
    { to: '/shortage-radar', icon: Radar, title: 'Shortage Radar', desc: 'Live national map of medicine risk across 198 facilities' },
    { to: '/ai-advisor', icon: Sparkles, title: 'AI Supply Advisor', desc: 'Ask questions in plain language, get grounded answers' },
    { to: '/predictions', icon: TrendingUp, title: 'Predictions', desc: '90-day stockout timeline grouped by urgency' },
    { to: '/redistribution', icon: ArrowRightLeft, title: 'Redistribution', desc: 'AI-recommended transfers from surplus to shortage' },
    { to: '/procurement', icon: AlertTriangle, title: 'Procurement', desc: 'End-to-end order workflow with approval chains' },
    { to: '/alerts', icon: Bell, title: 'Alerts', desc: 'Automatic notification when stockouts are imminent' },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white overflow-y-auto">
      <style>{`
        @keyframes radar-sweep {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes pulse-dot {
          0%, 100% { opacity: 0.15; transform: scale(1); }
          50% { opacity: 0.9; transform: scale(1.4); }
        }
        @keyframes drift {
          0% { transform: translate(0, 0); }
          50% { transform: translate(20px, -20px); }
          100% { transform: translate(0, 0); }
        }
        @keyframes grid-shift {
          from { background-position: 0 0; }
          to { background-position: 60px 60px; }
        }
        @keyframes float-cross {
          0%, 100% { transform: translateY(0) rotate(0deg); opacity: 0.03; }
          50% { transform: translateY(-20px) rotate(5deg); opacity: 0.06; }
        }
        .radar-sweep {
          animation: radar-sweep 20s linear infinite;
          transform-origin: center;
        }
        .pulse-dot {
          animation: pulse-dot 3s ease-in-out infinite;
        }
        .drift-slow {
          animation: drift 25s ease-in-out infinite;
        }
        .grid-shift {
          animation: grid-shift 40s linear infinite;
        }
        .float-cross {
          animation: float-cross 12s ease-in-out infinite;
        }
      `}</style>

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-20 px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/logo.svg" alt="Medisignal" className="w-9 h-9 rounded-lg" />
          <div>
            <div className="text-white font-semibold text-sm leading-tight">Medisignal</div>
            <div className="text-slate-500 text-[10px] uppercase tracking-wider">Africa</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-semibold uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-300 px-2 py-1 rounded">
            Demonstration Data
          </span>
          <Link to="/dashboard" className="text-xs text-slate-400 hover:text-cyan-400 transition inline-flex items-center gap-1">
            Skip to Dashboard
            <ArrowRight size={12} />
          </Link>
        </div>
      </div>

      {/* Hero section */}
      <div className="relative min-h-screen flex items-center justify-center px-6 py-24 overflow-hidden">
        {/* Base gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950" />

        {/* Animated grid */}
        <div
          className="grid-shift absolute inset-0 opacity-25"
          style={{
            backgroundImage:
              'linear-gradient(rgba(6, 182, 212, 0.09) 1px, transparent 1px), linear-gradient(90deg, rgba(6, 182, 212, 0.09) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />

        {/* Radar sweep */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
          <div className="relative w-[900px] h-[900px] max-w-none sm:max-w-[900px]">
            {/* Concentric circles */}
            <div className="absolute inset-0 rounded-full border border-cyan-500/10" />
            <div className="absolute inset-[12%] rounded-full border border-cyan-500/12" />
            <div className="absolute inset-[28%] rounded-full border border-cyan-500/15" />
            <div className="absolute inset-[44%] rounded-full border border-cyan-500/18" />
            {/* Rotating sweep */}
            <div className="radar-sweep absolute inset-0">
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  background: 'conic-gradient(from 0deg, rgba(6,182,212,0) 0deg, rgba(6,182,212,0.14) 60deg, rgba(6,182,212,0) 120deg)',
                }}
              />
            </div>
          </div>
        </div>

        {/* Center glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-cyan-500/10 blur-3xl drift-slow" />

        {/* Floating pulse dots */}
        <div className="absolute inset-0 pointer-events-none">
          {[
            { top: '18%', left: '12%', color: 'bg-cyan-400' },
            { top: '28%', left: '82%', color: 'bg-emerald-400' },
            { top: '72%', left: '8%', color: 'bg-orange-400' },
            { top: '62%', left: '88%', color: 'bg-cyan-400' },
            { top: '82%', left: '52%', color: 'bg-cyan-400' },
            { top: '12%', left: '48%', color: 'bg-emerald-400' },
            { top: '45%', left: '22%', color: 'bg-cyan-400' },
            { top: '55%', left: '76%', color: 'bg-orange-400' },
          ].map((dot, i) => (
            <span
              key={i}
              className={`pulse-dot absolute w-2 h-2 rounded-full ${dot.color}`}
              style={{
                top: dot.top,
                left: dot.left,
                boxShadow: dot.color === 'bg-cyan-400'
                  ? '0 0 12px rgba(34,211,238,0.9)'
                  : dot.color === 'bg-emerald-400'
                  ? '0 0 12px rgba(52,211,153,0.9)'
                  : '0 0 12px rgba(251,146,60,0.9)',
                animationDelay: `${i * 0.4}s`,
              }}
            />
          ))}
        </div>

        {/* Floating medical crosses */}
        <div className="absolute inset-0 pointer-events-none">
          {[
            { top: '15%', left: '22%', delay: '0s', size: 'w-8 h-8' },
            { top: '70%', left: '18%', delay: '2s', size: 'w-6 h-6' },
            { top: '25%', left: '75%', delay: '4s', size: 'w-10 h-10' },
            { top: '80%', left: '78%', delay: '6s', size: 'w-7 h-7' },
            { top: '48%', left: '5%', delay: '3s', size: 'w-5 h-5' },
            { top: '55%', left: '93%', delay: '5s', size: 'w-6 h-6' },
          ].map((cross, i) => (
            <svg
              key={i}
              className={`float-cross absolute ${cross.size} text-cyan-400`}
              style={{ top: cross.top, left: cross.left, animationDelay: cross.delay }}
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M10 2h4v6h6v4h-6v6h-4v-6H4V8h6V2z" />
            </svg>
          ))}
        </div>

        {/* Content */}
        <div className="relative max-w-4xl text-center z-10">
          <div className="inline-flex items-center gap-2 bg-cyan-500/10 border border-cyan-500/30 rounded-full px-3 py-1 mb-6 backdrop-blur-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-cyan-300 text-[11px] font-medium uppercase tracking-wider">
              AI-Powered Supply Chain Intelligence
            </span>
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05]">
            Predicting medicine
            <br />
            <span className="bg-gradient-to-r from-cyan-300 via-cyan-400 to-blue-400 bg-clip-text text-transparent">
              shortages
            </span>{' '}
            before
            <br />
            they happen.
          </h1>

          <p className="mt-6 text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Medisignal Africa sits above existing health information systems as an AI intelligence layer —
            forecasting stockouts, recommending redistribution, and flagging procurement risks across the continent.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-md px-6 py-3 text-sm font-semibold transition"
            >
              Explore the Platform
              <ArrowRight size={16} />
            </Link>
            <Link
              to="/ai-advisor"
              className="inline-flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-md px-6 py-3 text-sm font-semibold transition backdrop-blur-sm"
            >
              <Sparkles size={16} />
              Try the AI Advisor
            </Link>
          </div>

          <div className="mt-16 grid grid-cols-3 gap-4 max-w-2xl mx-auto">
            {[
              { value: '198', label: 'Health Facilities' },
              { value: '4', label: 'African Countries' },
              { value: '55', label: 'Essential Medicines' },
            ].map(s => (
              <div key={s.label} className="border border-white/10 bg-white/5 rounded-lg py-5 backdrop-blur-sm">
                <div className="text-3xl sm:text-4xl font-bold text-white tabular-nums">{s.value}</div>
                <div className="text-[11px] uppercase tracking-wider text-slate-400 mt-1">{s.label}</div>
              </div>
            ))}
          </div>

          <div className="mt-8 flex items-center justify-center gap-2 text-xs text-slate-500">
            <MapPin size={12} />
            <span>Covering Botswana, Ghana, Kenya and Nigeria</span>
          </div>
        </div>
      </div>

      {/* Features section */}
      <div className="relative border-t border-white/5 bg-slate-950">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-semibold tracking-tight">What the platform does</h2>
            <p className="text-slate-400 mt-2 max-w-2xl mx-auto text-sm">
              Six connected capabilities that move African health systems from reactive reporting to proactive intervention.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map(f => {
              const Icon = f.icon;
              return (
                <Link
                  key={f.to}
                  to={f.to}
                  className="group bg-white/5 hover:bg-white/[0.08] border border-white/10 hover:border-cyan-500/40 rounded-lg p-5 transition"
                >
                  <Icon size={22} className="text-cyan-400 mb-3" />
                  <div className="font-semibold text-white flex items-center gap-1">
                    {f.title}
                    <ArrowRight size={13} className="opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition" />
                  </div>
                  <div className="text-slate-400 text-xs mt-1 leading-relaxed">{f.desc}</div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* CTA section */}
      <div className="border-t border-white/5 bg-gradient-to-b from-slate-950 to-slate-900">
        <div className="max-w-4xl mx-auto px-6 py-20 text-center">
          <FileText size={28} className="mx-auto text-cyan-400 mb-4" />
          <h2 className="text-3xl font-semibold tracking-tight">Government-grade output</h2>
          <p className="text-slate-400 mt-3 max-w-2xl mx-auto text-sm leading-relaxed">
            Medisignal generates printable national situation reports with AI-written executive summaries —
            ready for ministry briefings, donor reporting, and health policy decisions.
          </p>
          <Link
            to="/shortage-radar"
            className="inline-flex items-center gap-2 mt-8 bg-white text-slate-950 hover:bg-slate-100 rounded-md px-5 py-2.5 text-sm font-semibold transition"
          >
            Generate a Report
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-white/5 bg-slate-950">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div>
            <div className="text-slate-400">Medisignal Africa · Demonstration Data</div>
            <div className="mt-1">
              Developed by <strong className="text-slate-300">Gabolekwe Topo Gabolekwe</strong> · Botswana · 2026
            </div>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="https://github.com/gabolekwetopo-bot/MediSignal-Africa"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 hover:text-cyan-400 transition"
            >
              <ExternalLink size={12} />
              Source code
            </a>
            <a
              href="https://medi-signal-africa.vercel.app"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 hover:text-cyan-400 transition"
            >
              <ExternalLink size={12} />
              Live demo
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
