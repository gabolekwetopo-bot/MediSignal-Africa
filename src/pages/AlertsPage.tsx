import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Clock, ArrowRightLeft, FileWarning, Bell, Filter, ShoppingCart, X, CheckCircle2 } from 'lucide-react';
import { supabase } from '../supabase';
import { useCountry } from '../context/CountryContext';

type AlertSeverity = 'critical' | 'warning' | 'info';
type AlertType = 'stockout' | 'delay' | 'redistribution' | 'surge';

interface AlertItem {
  id: string;
  severity: AlertSeverity;
  type: AlertType;
  title: string;
  detail: string;
  facility?: string;
  facility_id?: string;
  district?: string;
  medicine?: string;
  medicine_id?: string;
  daysValue?: number;
  date?: string;
  canProcure: boolean;
}

const SEVERITY_STYLES: Record<AlertSeverity, { bg: string; text: string; border: string; dot: string }> = {
  critical: { bg: 'bg-red-50', text: 'text-red-800', border: 'border-red-200', dot: 'bg-red-500' },
  warning: { bg: 'bg-orange-50', text: 'text-orange-800', border: 'border-orange-200', dot: 'bg-orange-500' },
  info: { bg: 'bg-cyan-50', text: 'text-cyan-800', border: 'border-cyan-200', dot: 'bg-cyan-500' },
};

const TYPE_ICONS: Record<AlertType, any> = {
  stockout: AlertTriangle,
  delay: Clock,
  redistribution: ArrowRightLeft,
  surge: FileWarning,
};

const TYPE_LABELS: Record<AlertType, string> = {
  stockout: 'Stockout risk',
  delay: 'Procurement delay',
  redistribution: 'Redistribution opportunity',
  surge: 'Unusual demand',
};

interface ProcureModalState {
  open: boolean;
  facility_id: string;
  facility: string;
  medicine_id: string;
  medicine: string;
}

export function AlertsPage() {
  const { country } = useCountry();
  const [radar, setRadar] = useState<any[]>([]);
  const [context, setContext] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState<AlertSeverity | ''>('');
  const [typeFilter, setTypeFilter] = useState<AlertType | ''>('');
  const [modal, setModal] = useState<ProcureModalState>({
    open: false, facility_id: '', facility: '', medicine_id: '', medicine: '',
  });
  const [quantity, setQuantity] = useState('500');
  const [expected, setExpected] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    const [radarRes, contextRes] = await Promise.all([
      supabase.rpc('get_shortage_radar', { country_filter: country }),
      supabase.rpc('get_supply_context', { country_filter: country }),
    ]);
    setRadar(radarRes.data ?? []);
    setContext(contextRes.data);
    setLoading(false);
  }

  useEffect(() => { loadData(); }, [country]);

  const alerts = useMemo<AlertItem[]>(() => {
    const out: AlertItem[] = [];
    const now = new Date();
    const in7 = new Date(now.getTime() + 7 * 86400000);
    const in14 = new Date(now.getTime() + 14 * 86400000);

    const seenStockouts = new Set<string>();
    for (const r of radar) {
      if (r.risk_level !== 'Critical' && r.risk_level !== 'High') continue;
      if (!r.projected_stockout_date) continue;
      const stockoutDate = new Date(r.projected_stockout_date);
      let severity: AlertSeverity | null = null;
      if (stockoutDate <= in7) severity = 'critical';
      else if (stockoutDate <= in14) severity = 'warning';
      if (!severity) continue;

      const key = `${r.facility_id}:${r.medicine_id}`;
      if (seenStockouts.has(key)) continue;
      seenStockouts.add(key);

      out.push({
        id: `stockout-${key}`,
        severity,
        type: 'stockout',
        title: `${r.medicine_name} at ${r.facility_name}`,
        detail: `Projected stockout on ${r.projected_stockout_date} (${Math.round(r.days_of_stock ?? 0)} days of stock remaining)`,
        facility: r.facility_name,
        facility_id: r.facility_id,
        district: r.district,
        medicine: r.medicine_name,
        medicine_id: r.medicine_id,
        date: r.projected_stockout_date,
        canProcure: true,
      });
    }

    const procurement = context?.procurement_risks?.top_delayed ?? [];
    for (const p of procurement) {
      const severity: AlertSeverity = p.days_overdue >= 20 ? 'critical' : p.days_overdue >= 10 ? 'warning' : 'info';
      out.push({
        id: `delay-${p.facility}-${p.medicine}`,
        severity,
        type: 'delay',
        title: `Delayed order: ${p.medicine} for ${p.facility}`,
        detail: `${p.days_overdue} days overdue (expected ${p.expected_delivery}, ordered qty ${p.quantity_ordered})`,
        facility: p.facility,
        medicine: p.medicine,
        daysValue: p.days_overdue,
        date: p.expected_delivery,
        canProcure: false,
      });
    }

    const redist = context?.redistribution_opportunities ?? [];
    for (const r of redist) {
      const urgency: AlertSeverity = (r.at_risk_days_of_stock ?? 999) < 3 ? 'critical' : 'warning';
      out.push({
        id: `redist-${r.medicine}-${r.surplus_facility}-${r.at_risk_facility}`,
        severity: urgency,
        type: 'redistribution',
        title: `Redistribute ${r.medicine}`,
        detail: `${r.surplus_facility} (${Math.round(r.surplus_days_of_stock ?? 0)}d surplus) can cover ${r.at_risk_facility} (${(r.at_risk_days_of_stock ?? 0).toFixed(1)}d remaining)`,
        medicine: r.medicine,
        facility: r.at_risk_facility,
        canProcure: false,
      });
    }

    const signals = context?.unusual_demand_signals ?? [];
    for (const s of signals) {
      out.push({
        id: `surge-${s.facility}-${s.medicine}`,
        severity: 'info',
        type: 'surge',
        title: `Unusual demand: ${s.medicine} at ${s.facility}`,
        detail: `Last month consumption ${s.last_month_consumption} vs 6-month average ${s.six_month_average} (×${s.spike_factor?.toFixed?.(1) ?? '?'} spike)`,
        facility: s.facility,
        medicine: s.medicine,
        canProcure: false,
      });
    }

    const order: Record<AlertSeverity, number> = { critical: 1, warning: 2, info: 3 };
    return out.sort((a, b) => order[a.severity] - order[b.severity]);
  }, [radar, context]);

  const filtered = useMemo(() => {
    return alerts.filter(a => {
      if (severityFilter && a.severity !== severityFilter) return false;
      if (typeFilter && a.type !== typeFilter) return false;
      return true;
    });
  }, [alerts, severityFilter, typeFilter]);

  const counts = useMemo(() => ({
    critical: alerts.filter(a => a.severity === 'critical').length,
    warning: alerts.filter(a => a.severity === 'warning').length,
    info: alerts.filter(a => a.severity === 'info').length,
    total: alerts.length,
  }), [alerts]);

  function openProcureModal(alert: AlertItem) {
    if (!alert.facility_id || !alert.medicine_id) return;
    // Default expected delivery: 30 days from now
    const d = new Date();
    d.setDate(d.getDate() + 30);
    setModal({
      open: true,
      facility_id: alert.facility_id,
      facility: alert.facility ?? '',
      medicine_id: alert.medicine_id,
      medicine: alert.medicine ?? '',
    });
    setQuantity('500');
    setExpected(d.toISOString().slice(0, 10));
    setSuccess(null);
  }

  function closeModal() {
    setModal({ open: false, facility_id: '', facility: '', medicine_id: '', medicine: '' });
    setSuccess(null);
  }

  async function submitProcurement() {
    if (!modal.facility_id || !modal.medicine_id || !quantity || !expected) return;
    setSubmitting(true);
    setSuccess(null);

    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty <= 0) {
      setSuccess('Quantity must be a positive number.');
      setSubmitting(false);
      return;
    }

    const orderId = `procurement:manual:${modal.facility_id}:${modal.medicine_id}:${Date.now()}`;
    const uuid = crypto.randomUUID ? crypto.randomUUID() :
      'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });

    const { error } = await supabase.from('procurement').insert({
      id: uuid,
      facility_id: modal.facility_id,
      medicine_id: modal.medicine_id,
      order_date: new Date().toISOString().slice(0, 10),
      expected_delivery: expected,
      quantity_ordered: qty,
      quantity_received: 0,
      status: 'pending',
    });

    if (error) {
      setSuccess(`Failed to create order: ${error.message}`);
      setSubmitting(false);
      return;
    }

    setSuccess(`Purchase order created for ${qty} units of ${modal.medicine} at ${modal.facility}. Expected delivery ${expected}.`);
    setSubmitting(false);

    // Refresh alerts after a short delay so the new order appears
    setTimeout(() => {
      loadData();
    }, 800);
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
          <Bell size={22} className="text-cyan-500" />
          Alerts
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Automatic notifications of critical events across {country ?? 'all countries'} — generated from live supply data
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-red-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Critical</span>
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          </div>
          <div className="mt-2 text-3xl font-bold text-red-600 tabular-nums">{counts.critical}</div>
        </div>
        <div className="bg-white border border-orange-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Warning</span>
            <span className="w-2 h-2 rounded-full bg-orange-500" />
          </div>
          <div className="mt-2 text-3xl font-bold text-orange-600 tabular-nums">{counts.warning}</div>
        </div>
        <div className="bg-white border border-cyan-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Information</span>
            <span className="w-2 h-2 rounded-full bg-cyan-500" />
          </div>
          <div className="mt-2 text-3xl font-bold text-cyan-600 tabular-nums">{counts.info}</div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-2 text-slate-500">
          <Filter size={14} />
          <span className="text-xs font-medium uppercase tracking-wider">Filters</span>
        </div>
        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value as AlertSeverity | '')}
          className="px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-cyan-500"
        >
          <option value="">All severities</option>
          <option value="critical">Critical</option>
          <option value="warning">Warning</option>
          <option value="info">Information</option>
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as AlertType | '')}
          className="px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-cyan-500"
        >
          <option value="">All types</option>
          <option value="stockout">Stockout risk</option>
          <option value="delay">Procurement delay</option>
          <option value="redistribution">Redistribution</option>
          <option value="surge">Unusual demand</option>
        </select>
        <div className="text-xs text-slate-500 self-center ml-auto">
          {filtered.length} of {counts.total} alerts
        </div>
      </div>

      <div className="space-y-2">
        {loading && (
          <div className="bg-white border border-slate-200 rounded-lg p-8 text-center text-slate-400 text-sm">
            Loading alerts…
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="bg-white border border-slate-200 rounded-lg p-8 text-center">
            <Bell size={24} className="mx-auto text-slate-300 mb-2" />
            <div className="text-sm text-slate-500">No alerts match your filters</div>
          </div>
        )}
        {filtered.map(alert => {
          const style = SEVERITY_STYLES[alert.severity];
          const Icon = TYPE_ICONS[alert.type];
          return (
            <div key={alert.id} className={`bg-white border rounded-lg p-4 flex items-start gap-3 hover:shadow-sm transition ${style.border}`}>
              <div className={`p-2 rounded ${style.bg} ${style.text} flex-shrink-0`}>
                <Icon size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className={`inline-block w-1.5 h-1.5 rounded-full ${style.dot}`} />
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${style.text}`}>
                    {alert.severity}
                  </span>
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider">
                    · {TYPE_LABELS[alert.type]}
                  </span>
                </div>
                <div className="font-medium text-slate-800 text-sm">{alert.title}</div>
                <div className="text-xs text-slate-500 mt-1">{alert.detail}</div>
              </div>
              {alert.canProcure && (
                <button
                  onClick={() => openProcureModal(alert)}
                  className="inline-flex items-center gap-1.5 bg-cyan-500 hover:bg-cyan-600 text-white rounded-md px-3 py-1.5 text-xs font-medium transition flex-shrink-0"
                >
                  <ShoppingCart size={12} />
                  Procure
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs text-slate-600 leading-relaxed">
        <strong className="text-slate-800">How alerts work:</strong> Alerts are generated in real time from the live supply snapshot. 
        Stockout alerts fire when a facility-medicine pair is projected to run out within 14 days. 
        Procurement delays fire when an order passes its expected delivery date. 
        Redistribution alerts fire when a surplus facility can cover a shortage at another. 
        Click <strong>Procure</strong> on a stockout alert to raise a purchase order directly.
      </div>

      {modal.open && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={closeModal}>
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="font-semibold text-slate-900 flex items-center gap-2">
                  <ShoppingCart size={16} className="text-cyan-500" />
                  Raise Purchase Order
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">Create a procurement request for this stockout</p>
              </div>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-700 p-1">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 block mb-1">Facility</label>
                <div className="text-sm text-slate-800 font-medium">{modal.facility}</div>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 block mb-1">Medicine</label>
                <div className="text-sm text-slate-800 font-medium">{modal.medicine}</div>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 block mb-1">Quantity Ordered</label>
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 block mb-1">Expected Delivery</label>
                <input
                  type="date"
                  value={expected}
                  onChange={(e) => setExpected(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            {success && (
              <div className={`mt-4 text-xs p-3 rounded border flex items-start gap-2 ${
                success.startsWith('Failed')
                  ? 'bg-red-50 border-red-200 text-red-800'
                  : 'bg-green-50 border-green-200 text-green-800'
              }`}>
                {!success.startsWith('Failed') && <CheckCircle2 size={14} className="mt-0.5 flex-shrink-0" />}
                <span>{success}</span>
              </div>
            )}

            <div className="flex gap-2 justify-end mt-5">
              <button
                onClick={closeModal}
                className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900"
              >
                Cancel
              </button>
              <button
                onClick={submitProcurement}
                disabled={submitting}
                className="inline-flex items-center gap-2 bg-cyan-500 hover:bg-cyan-600 disabled:bg-slate-300 text-white rounded-md px-4 py-2 text-sm font-medium transition"
              >
                <ShoppingCart size={14} />
                {submitting ? 'Submitting…' : 'Create Order'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
