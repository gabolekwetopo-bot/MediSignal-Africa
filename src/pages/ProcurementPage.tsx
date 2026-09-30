import { useEffect, useMemo, useState } from 'react';
import { Search, AlertTriangle, Clock, CheckCircle2, Plus, ChevronUp, ChevronDown, X, ShoppingCart, Truck, Package, Ban } from 'lucide-react';
import { supabase } from '../supabase';
import { useCountry } from '../context/CountryContext';

interface ProcurementRow {
  id: string;
  facility_id: string;
  medicine_id: string;
  order_date: string;
  expected_delivery: string | null;
  quantity_ordered: number;
  quantity_received: number;
  status: string;
  rejection_reason: string | null;
  approved_by: string | null;
  approved_at: string | null;
  dispatched_at: string | null;
  delivered_at: string | null;
  created_by: string | null;
}

interface FacilityLite { id: string; name: string; country: string; district: string; }
interface MedicineLite { id: string; name: string; category: string; }

type SortKey = 'facility' | 'medicine' | 'order_date' | 'expected_delivery' | 'quantity_ordered' | 'days_overdue' | 'status';
type SortDir = 'asc' | 'desc';

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    delivered: 'bg-green-100 text-green-800 border-green-300',
    in_transit: 'bg-blue-100 text-blue-800 border-blue-300',
    approved: 'bg-indigo-100 text-indigo-800 border-indigo-300',
    pending: 'bg-slate-100 text-slate-700 border-slate-300',
    delayed: 'bg-red-100 text-red-800 border-red-300',
    cancelled: 'bg-gray-100 text-gray-500 border-gray-300',
  };
  return (
    <span className={`inline-block px-2 py-0.5 text-[10px] font-semibold border rounded uppercase tracking-wide ${styles[status] ?? styles.pending}`}>
      {status.replace('_', ' ')}
    </span>
  );
}

function daysOverdue(expected: string | null, status: string): number {
  if (!expected || status === 'delivered' || status === 'cancelled') return 0;
  const now = new Date();
  const exp = new Date(expected);
  const diff = Math.floor((now.getTime() - exp.getTime()) / 86400000);
  return diff > 0 ? diff : 0;
}

export function ProcurementPage() {
  const { country } = useCountry();
  const [procurement, setProcurement] = useState<ProcurementRow[]>([]);
  const [facilities, setFacilities] = useState<FacilityLite[]>([]);
  const [medicines, setMedicines] = useState<MedicineLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [riskOnly, setRiskOnly] = useState(false);
  const [approvalQueueOnly, setApprovalQueueOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('days_overdue');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [actionModal, setActionModal] = useState<{ open: boolean; order: ProcurementRow | null; action: string }>({ open: false, order: null, action: '' });
  const [rejectReason, setRejectReason] = useState('');
  const [creating, setCreating] = useState(false);
  const [newOrder, setNewOrder] = useState({ facility_id: '', medicine_id: '', quantity: '500', expected: '' });
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function loadAll() {
    setLoading(true);
    const [procRes, facRes, medRes] = await Promise.all([
      supabase.from('procurement').select('*').order('order_date', { ascending: false }),
      country
        ? supabase.from('facilities').select('id, name, country, district').eq('country', country)
        : supabase.from('facilities').select('id, name, country, district'),
      supabase.from('medicines').select('id, name, category'),
    ]);
    const facList = (facRes.data ?? []) as FacilityLite[];
    const facMap = new Map(facList.map(f => [f.id, f]));
    const filtered = ((procRes.data ?? []) as ProcurementRow[]).filter(p => facMap.has(p.facility_id));
    setProcurement(filtered);
    setFacilities(facList);
    setMedicines((medRes.data ?? []) as MedicineLite[]);
    setLoading(false);
  }

  useEffect(() => { loadAll(); }, [country]);

  const facilityMap = useMemo(() => new Map(facilities.map(f => [f.id, f])), [facilities]);
  const medicineMap = useMemo(() => new Map(medicines.map(m => [m.id, m])), [medicines]);

  const enriched = useMemo(() => {
    return procurement.map(p => {
      const fac = facilityMap.get(p.facility_id);
      const med = medicineMap.get(p.medicine_id);
      const overdue = daysOverdue(p.expected_delivery, p.status);
      return {
        ...p,
        facilityName: fac?.name ?? '—',
        facilityDistrict: fac?.district ?? '—',
        facilityCountry: fac?.country ?? '—',
        medicineName: med?.name ?? '—',
        medicineCategory: med?.category ?? '—',
        daysOverdue: overdue,
        isAtRisk: overdue > 0 || p.status === 'delayed',
      };
    });
  }, [procurement, facilityMap, medicineMap]);

  const kpis = useMemo(() => ({
    pending: enriched.filter(e => e.status === 'pending').length,
    delayed: enriched.filter(e => e.status === 'delayed').length,
    inTransit: enriched.filter(e => e.status === 'in_transit').length,
    delivered: enriched.filter(e => e.status === 'delivered').length,
    total: enriched.length,
  }), [enriched]);

  const statuses = ['pending', 'approved', 'in_transit', 'delayed', 'delivered', 'cancelled'];

  const filtered = useMemo(() => {
    const list = enriched.filter(p => {
      if (statusFilter && p.status !== statusFilter) return false;
      if (riskOnly && !p.isAtRisk) return false;
      if (approvalQueueOnly && p.status !== 'pending') return false;
      if (search) {
        const q = search.toLowerCase();
        if (!p.facilityName.toLowerCase().includes(q) &&
            !p.medicineName.toLowerCase().includes(q) &&
            !p.facilityDistrict.toLowerCase().includes(q)) return false;
      }
      return true;
    });

    const dir = sortDir === 'asc' ? 1 : -1;
    return list.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'facility': cmp = a.facilityName.localeCompare(b.facilityName); break;
        case 'medicine': cmp = a.medicineName.localeCompare(b.medicineName); break;
        case 'order_date': cmp = (a.order_date ?? '').localeCompare(b.order_date ?? ''); break;
        case 'expected_delivery': cmp = (a.expected_delivery ?? '').localeCompare(b.expected_delivery ?? ''); break;
        case 'quantity_ordered': cmp = a.quantity_ordered - b.quantity_ordered; break;
        case 'days_overdue': cmp = a.daysOverdue - b.daysOverdue; break;
        case 'status': cmp = a.status.localeCompare(b.status); break;
      }
      return cmp * dir;
    });
  }, [enriched, statusFilter, riskOnly, approvalQueueOnly, search, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
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

  function openAction(order: ProcurementRow, action: string) {
    setActionModal({ open: true, order, action });
    setRejectReason('');
    setResult(null);
  }

  function closeAction() {
    setActionModal({ open: false, order: null, action: '' });
    setRejectReason('');
  }

  async function executeAction() {
    if (!actionModal.order) return;
    const { order, action } = actionModal;
    const updates: any = {};

    if (action === 'approve') {
      updates.status = 'approved';
      updates.approved_by = 'demo-user';
      updates.approved_at = new Date().toISOString();
    } else if (action === 'reject') {
      if (!rejectReason.trim()) {
        setResult({ ok: false, message: 'Please enter a rejection reason.' });
        return;
      }
      updates.status = 'cancelled';
      updates.rejection_reason = rejectReason;
    } else if (action === 'dispatch') {
      updates.status = 'in_transit';
      updates.dispatched_at = new Date().toISOString();
    } else if (action === 'deliver') {
      updates.status = 'delivered';
      updates.quantity_received = order.quantity_ordered;
      updates.delivered_at = new Date().toISOString();
    }

    const { error } = await supabase.from('procurement').update(updates).eq('id', order.id);
    if (error) {
      setResult({ ok: false, message: `Failed: ${error.message}` });
      return;
    }

    setResult({ ok: true, message: `Order ${action === 'deliver' ? 'marked delivered' : action + 'd'}.` });
    setTimeout(() => {
      closeAction();
      loadAll();
    }, 700);
  }

  async function createOrder() {
    if (!newOrder.facility_id || !newOrder.medicine_id || !newOrder.quantity || !newOrder.expected) {
      setResult({ ok: false, message: 'Please fill in all fields.' });
      return;
    }
    const qty = parseInt(newOrder.quantity, 10);
    if (isNaN(qty) || qty <= 0) {
      setResult({ ok: false, message: 'Quantity must be a positive number.' });
      return;
    }

    const uuid = crypto.randomUUID ? crypto.randomUUID() :
      'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });

    const { error } = await supabase.from('procurement').insert({
      id: uuid,
      facility_id: newOrder.facility_id,
      medicine_id: newOrder.medicine_id,
      order_date: new Date().toISOString().slice(0, 10),
      expected_delivery: newOrder.expected,
      quantity_ordered: qty,
      quantity_received: 0,
      status: 'pending',
      created_by: 'demo-user',
    });

    if (error) {
      setResult({ ok: false, message: `Failed to create order: ${error.message}` });
      return;
    }

    setResult({ ok: true, message: `Order created for ${qty} units. Awaiting approval.` });
    setTimeout(() => {
      setCreating(false);
      setNewOrder({ facility_id: '', medicine_id: '', quantity: '500', expected: '' });
      setResult(null);
      loadAll();
    }, 800);
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Procurement</h1>
          <p className="text-slate-500 text-sm mt-1">
            {kpis.total} orders tracked {country ? `· ${country}` : '· All Africa'}
          </p>
        </div>
        <button
          onClick={() => { setCreating(true); setResult(null); setNewOrder({ facility_id: '', medicine_id: '', quantity: '500', expected: '' }); }}
          className="inline-flex items-center gap-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-md px-4 py-2 text-sm font-medium transition"
        >
          <Plus size={14} />
          Create Order
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Awaiting Approval</span>
            <Clock size={16} className="text-slate-500" />
          </div>
          <div className="mt-2 text-3xl font-bold text-slate-900 tabular-nums">{kpis.pending}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Delayed</span>
            <AlertTriangle size={16} className="text-red-500" />
          </div>
          <div className="mt-2 text-3xl font-bold text-red-600 tabular-nums">{kpis.delayed}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">In Transit</span>
            <Truck size={16} className="text-blue-500" />
          </div>
          <div className="mt-2 text-3xl font-bold text-blue-600 tabular-nums">{kpis.inTransit}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Delivered</span>
            <CheckCircle2 size={16} className="text-green-500" />
          </div>
          <div className="mt-2 text-3xl font-bold text-green-600 tabular-nums">{kpis.delivered}</div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="flex-1 relative min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search facility or medicine..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-cyan-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-cyan-500"
        >
          <option value="">All statuses</option>
          {statuses.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>
        <label className="flex items-center gap-2 px-3 py-2 text-sm border border-slate-300 rounded-md cursor-pointer hover:border-cyan-500">
          <input
            type="checkbox"
            checked={approvalQueueOnly}
            onChange={(e) => setApprovalQueueOnly(e.target.checked)}
            className="accent-cyan-500"
          />
          <span className="text-slate-700">Approval queue only</span>
        </label>
        <label className="flex items-center gap-2 px-3 py-2 text-sm border border-slate-300 rounded-md cursor-pointer hover:border-cyan-500">
          <input
            type="checkbox"
            checked={riskOnly}
            onChange={(e) => setRiskOnly(e.target.checked)}
            className="accent-red-500"
          />
          <span className="text-slate-700">At risk only</span>
        </label>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
              <tr>
                <SortHeader label="Facility" k="facility" />
                <SortHeader label="Medicine" k="medicine" />
                <SortHeader label="Order Date" k="order_date" />
                <SortHeader label="Expected" k="expected_delivery" />
                <SortHeader label="Qty" k="quantity_ordered" align="right" />
                <SortHeader label="Overdue" k="days_overdue" align="right" />
                <SortHeader label="Status" k="status" />
                <th className="text-right px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id} className={`border-t border-slate-100 hover:bg-slate-50/50 ${p.isAtRisk ? 'bg-red-50/30' : ''}`}>
                  <td className="px-4 py-2">
                    <div className="font-medium text-slate-800">{p.facilityName}</div>
                    <div className="text-[11px] text-slate-400">{p.facilityDistrict} · {p.facilityCountry}</div>
                  </td>
                  <td className="px-4 py-2">
                    <div className="text-slate-700">{p.medicineName}</div>
                    <div className="text-[11px] text-slate-400">{p.medicineCategory}</div>
                  </td>
                  <td className="px-4 py-2 text-slate-500 text-xs tabular-nums">{p.order_date}</td>
                  <td className="px-4 py-2 text-slate-500 text-xs tabular-nums">{p.expected_delivery ?? '—'}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-slate-700">{p.quantity_ordered}</td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {p.daysOverdue > 0 ? (
                      <span className="text-red-600 font-semibold">{p.daysOverdue}d</span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2"><StatusBadge status={p.status} /></td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {p.status === 'pending' && (
                        <>
                          <button
                            onClick={() => openAction(p, 'approve')}
                            className="text-[10px] font-semibold uppercase tracking-wider text-green-700 hover:text-green-900 px-2 py-1 rounded hover:bg-green-50"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => openAction(p, 'reject')}
                            className="text-[10px] font-semibold uppercase tracking-wider text-red-700 hover:text-red-900 px-2 py-1 rounded hover:bg-red-50"
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {p.status === 'approved' && (
                        <button
                          onClick={() => openAction(p, 'dispatch')}
                          className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-blue-700 hover:text-blue-900 px-2 py-1 rounded hover:bg-blue-50"
                        >
                          <Truck size={11} /> Dispatch
                        </button>
                      )}
                      {p.status === 'in_transit' && (
                        <button
                          onClick={() => openAction(p, 'deliver')}
                          className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-green-700 hover:text-green-900 px-2 py-1 rounded hover:bg-green-50"
                        >
                          <Package size={11} /> Mark Delivered
                        </button>
                      )}
                      {p.rejection_reason && (
                        <span title={p.rejection_reason} className="text-[10px] text-slate-400 italic cursor-help">reason</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && !loading && (
                <tr><td colSpan={8} className="text-center text-slate-400 py-8 text-sm">No orders match your filters</td></tr>
              )}
              {loading && (
                <tr><td colSpan={8} className="text-center text-slate-400 py-8 text-sm">Loading...</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action modal (approve/reject/dispatch/deliver) */}
      {actionModal.open && actionModal.order && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={closeAction}>
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="font-semibold text-slate-900 capitalize">
                  {actionModal.action === 'deliver' ? 'Mark as delivered' : actionModal.action + ' order'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {actionModal.order.quantity_ordered} units of {medicineMap.get(actionModal.order.medicine_id)?.name}
                </p>
              </div>
              <button onClick={closeAction} className="text-slate-400 hover:text-slate-700 p-1">
                <X size={16} />
              </button>
            </div>

            {actionModal.action === 'reject' && (
              <div className="mb-4">
                <label className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 block mb-1">Rejection Reason *</label>
                <textarea
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-cyan-500 resize-none"
                  placeholder="e.g. Budget not available for this quarter"
                />
              </div>
            )}

            {result && (
              <div className={`text-xs p-3 rounded border mb-3 ${result.ok ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                {result.message}
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <button onClick={closeAction} className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900">Cancel</button>
              <button
                onClick={executeAction}
                className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-white transition ${
                  actionModal.action === 'reject' ? 'bg-red-500 hover:bg-red-600' : 'bg-cyan-500 hover:bg-cyan-600'
                }`}
              >
                {actionModal.action === 'approve' && <CheckCircle2 size={14} />}
                {actionModal.action === 'reject' && <Ban size={14} />}
                {actionModal.action === 'dispatch' && <Truck size={14} />}
                {actionModal.action === 'deliver' && <Package size={14} />}
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create order modal */}
      {creating && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => { setCreating(false); setResult(null); }}>
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="font-semibold text-slate-900 flex items-center gap-2">
                  <ShoppingCart size={16} className="text-cyan-500" />
                  Create Purchase Order
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">Order will be submitted to the approval queue</p>
              </div>
              <button onClick={() => { setCreating(false); setResult(null); }} className="text-slate-400 hover:text-slate-700 p-1">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 block mb-1">Facility</label>
                <select
                  value={newOrder.facility_id}
                  onChange={e => setNewOrder({ ...newOrder, facility_id: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-cyan-500"
                >
                  <option value="">— select facility —</option>
                  {facilities.sort((a, b) => a.name.localeCompare(b.name)).map(f => (
                    <option key={f.id} value={f.id}>{f.name} ({f.country})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 block mb-1">Medicine</label>
                <select
                  value={newOrder.medicine_id}
                  onChange={e => setNewOrder({ ...newOrder, medicine_id: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-cyan-500"
                >
                  <option value="">— select medicine —</option>
                  {medicines.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 block mb-1">Quantity</label>
                <input
                  type="number"
                  min="1"
                  value={newOrder.quantity}
                  onChange={e => setNewOrder({ ...newOrder, quantity: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 block mb-1">Expected Delivery</label>
                <input
                  type="date"
                  value={newOrder.expected}
                  onChange={e => setNewOrder({ ...newOrder, expected: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            {result && (
              <div className={`mt-4 text-xs p-3 rounded border ${result.ok ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                {result.message}
              </div>
            )}

            <div className="flex gap-2 justify-end mt-5">
              <button onClick={() => { setCreating(false); setResult(null); }} className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900">Cancel</button>
              <button
                onClick={createOrder}
                className="inline-flex items-center gap-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-md px-4 py-2 text-sm font-medium transition"
              >
                <ShoppingCart size={14} />
                Submit for Approval
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
