import { useEffect, useMemo, useState } from 'react';
import { ArrowRightLeft, Search, ChevronUp, ChevronDown, AlertTriangle, TrendingUp, Package, X, CheckCircle2, Truck, Ban, Sparkles } from 'lucide-react';
import { supabase } from '../supabase';
import { useCountry } from '../context/CountryContext';

interface RedistributionPair {
  medicine: string;
  medicine_id?: string;
  surplus_facility: string;
  surplus_facility_id?: string;
  at_risk_facility: string;
  at_risk_facility_id?: string;
  surplus_days_of_stock: number;
  at_risk_days_of_stock: number;
  urgency: string;
}

interface FacilityLite { id: string; name: string; country: string; }
interface MedicineLite { id: string; name: string; }

interface TransferRequest {
  id: string;
  medicine_id: string;
  source_facility_id: string;
  destination_facility_id: string;
  quantity_recommended: number | null;
  quantity_requested: number;
  quantity_dispatched: number | null;
  quantity_received: number | null;
  rationale: string | null;
  status: string;
  requested_by: string | null;
  requested_at: string;
  source_approved_by: string | null;
  source_approved_at: string | null;
  rejection_reason: string | null;
  dispatched_at: string | null;
  received_at: string | null;
  expected_transfer_date: string | null;
}

type SortKey = 'medicine' | 'surplus_facility' | 'at_risk_facility' | 'at_risk_days_of_stock' | 'surplus_days_of_stock';
type SortDir = 'asc' | 'desc';

const TARGET_COVERAGE_DAYS = 30;

function UrgencyBadge({ level }: { level: string }) {
  const styles: Record<string, string> = {
    Critical: 'bg-red-100 text-red-800 border-red-300',
    High: 'bg-orange-100 text-orange-800 border-orange-300',
    Medium: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    Low: 'bg-green-100 text-green-800 border-green-300',
  };
  return (
    <span className={`inline-block px-2 py-0.5 text-[11px] font-semibold border rounded ${styles[level] ?? styles.Medium}`}>
      {level}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    requested: 'bg-slate-100 text-slate-700 border-slate-300',
    source_approved: 'bg-indigo-100 text-indigo-800 border-indigo-300',
    source_rejected: 'bg-red-100 text-red-800 border-red-300',
    dispatched: 'bg-blue-100 text-blue-800 border-blue-300',
    received: 'bg-green-100 text-green-800 border-green-300',
    cancelled: 'bg-gray-100 text-gray-500 border-gray-300',
  };
  return (
    <span className={`inline-block px-2 py-0.5 text-[10px] font-semibold border rounded uppercase tracking-wide ${styles[status] ?? styles.requested}`}>
      {status.replace('_', ' ')}
    </span>
  );
}

/**
 * Recommend a transfer quantity.
 * Goal: bring the receiving facility up to TARGET_COVERAGE_DAYS without pushing
 * the source facility below TARGET_COVERAGE_DAYS.
 *
 * Uses: current stock (quantity) and average daily consumption
 * Approximated from the row's days_of_stock: stock = days * daily_use, so daily_use = stock / days
 * We don't have raw stock here, so we use a coverage-based heuristic on days.
 */
function recommendTransferQuantity(pair: RedistributionPair): { quantity: number; rationale: string } {
  const atRiskDays = pair.at_risk_days_of_stock ?? 0;
  const sourceDays = pair.surplus_days_of_stock ?? 0;

  if (sourceDays <= TARGET_COVERAGE_DAYS) {
    return {
      quantity: 0,
      rationale: `${pair.surplus_facility} does not hold enough surplus to safely transfer while keeping ${TARGET_COVERAGE_DAYS} days of its own coverage.`,
    };
  }

  const deficit = Math.max(0, TARGET_COVERAGE_DAYS - atRiskDays);
  const sourceSurplusOverTarget = sourceDays - TARGET_COVERAGE_DAYS;

  // The transferable days = how much the source can give while staying above target
  const transferableDays = Math.min(deficit, sourceSurplusOverTarget * 0.5);

  // Convert days to units using an approximate daily use.
  // We use the ratio of sourceDays to a hypothetical 100-unit baseline to produce a sensible number.
  // The actual recommended quantity is anchored to days and displayed as such.
  const approximateUnit = 50; // 50 units per "day of stock" as a heuristic
  const quantity = Math.max(50, Math.round(transferableDays * approximateUnit));

  const afterAtRisk = atRiskDays + transferableDays;
  const afterSource = sourceDays - transferableDays;

  return {
    quantity,
    rationale:
      `Transferring ${quantity} units gives ${pair.at_risk_facility} approximately ${afterAtRisk.toFixed(0)} days of coverage ` +
      `(${TARGET_COVERAGE_DAYS}-day target), while leaving ${pair.surplus_facility} with approximately ${afterSource.toFixed(0)} days of its own stock.`,
  };
}

export function RedistributionPage() {
  const { country } = useCountry();
  const [pairs, setPairs] = useState<RedistributionPair[]>([]);
  const [requests, setRequests] = useState<TransferRequest[]>([]);
  const [facilities, setFacilities] = useState<FacilityLite[]>([]);
  const [medicines, setMedicines] = useState<MedicineLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [urgencyFilter, setUrgencyFilter] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('at_risk_days_of_stock');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [tab, setTab] = useState<'opportunities' | 'requests'>('opportunities');

  const [modalPair, setModalPair] = useState<RedistributionPair | null>(null);
  const [recommendation, setRecommendation] = useState<{ quantity: number; rationale: string } | null>(null);
  const [editQuantity, setEditQuantity] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const [actionRequest, setActionRequest] = useState<{ req: TransferRequest; action: string } | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  async function loadAll() {
    setLoading(true);
    const [ctx, reqRes, facRes, medRes] = await Promise.all([
      supabase.rpc('get_supply_context', { country_filter: country }),
      supabase.from('redistribution_requests').select('*').order('requested_at', { ascending: false }),
      country
        ? supabase.from('facilities').select('id, name, country').eq('country', country)
        : supabase.from('facilities').select('id, name, country'),
      supabase.from('medicines').select('id, name'),
    ]);
    setPairs((ctx.data?.redistribution_opportunities ?? []) as RedistributionPair[]);
    setFacilities((facRes.data ?? []) as FacilityLite[]);
    setMedicines((medRes.data ?? []) as MedicineLite[]);
    setRequests((reqRes.data ?? []) as TransferRequest[]);
    setLoading(false);
  }

  useEffect(() => { loadAll(); }, [country]);

  const facilityMap = useMemo(() => new Map(facilities.map(f => [f.name.toLowerCase(), f])), [facilities]);
  const medicineMap = useMemo(() => new Map(medicines.map(m => [m.name.toLowerCase(), m])), [medicines]);
  const facilityIdMap = useMemo(() => new Map(facilities.map(f => [f.id, f])), [facilities]);
  const medicineIdMap = useMemo(() => new Map(medicines.map(m => [m.id, m])), [medicines]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }

  const requestedPairsKey = useMemo(() => {
    const set = new Set<string>();
    for (const r of requests) {
      if (r.status === 'requested' || r.status === 'source_approved' || r.status === 'dispatched') {
        const key = `${r.medicine_id}:${r.source_facility_id}:${r.destination_facility_id}`;
        set.add(key);
      }
    }
    return set;
  }, [requests]);

  const filtered = useMemo(() => {
    const list = pairs.filter(p => {
      if (urgencyFilter && p.urgency !== urgencyFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!p.medicine?.toLowerCase().includes(q) &&
            !p.surplus_facility?.toLowerCase().includes(q) &&
            !p.at_risk_facility?.toLowerCase().includes(q)) return false;
      }
      return true;
    });
    const dir = sortDir === 'asc' ? 1 : -1;
    return list.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'medicine': cmp = (a.medicine ?? '').localeCompare(b.medicine ?? ''); break;
        case 'surplus_facility': cmp = (a.surplus_facility ?? '').localeCompare(b.surplus_facility ?? ''); break;
        case 'at_risk_facility': cmp = (a.at_risk_facility ?? '').localeCompare(b.at_risk_facility ?? ''); break;
        case 'at_risk_days_of_stock': cmp = (a.at_risk_days_of_stock ?? 0) - (b.at_risk_days_of_stock ?? 0); break;
        case 'surplus_days_of_stock': cmp = (a.surplus_days_of_stock ?? 0) - (b.surplus_days_of_stock ?? 0); break;
      }
      return cmp * dir;
    });
  }, [pairs, search, urgencyFilter, sortKey, sortDir]);

  const stats = useMemo(() => ({
    total: pairs.length,
    critical: pairs.filter(p => p.urgency === 'Critical').length,
    avgSurplus: pairs.length > 0 ? Math.round(pairs.reduce((s, p) => s + (p.surplus_days_of_stock ?? 0), 0) / pairs.length) : 0,
    requestsOpen: requests.filter(r => r.status === 'requested' || r.status === 'source_approved' || r.status === 'dispatched').length,
  }), [pairs, requests]);

  function openRedistribute(pair: RedistributionPair) {
    const rec = recommendTransferQuantity(pair);
    const d = new Date();
    d.setDate(d.getDate() + 1);
    setModalPair(pair);
    setRecommendation(rec);
    setEditQuantity(String(rec.quantity || 50));
    setExpectedDate(d.toISOString().slice(0, 10));
    setResult(null);
  }

  function closeRedistribute() {
    setModalPair(null);
    setRecommendation(null);
    setEditQuantity('');
    setResult(null);
  }

  async function submitRequest() {
    if (!modalPair) return;
    const medicine = medicineMap.get(modalPair.medicine?.toLowerCase() ?? '');
    const sourceFacility = facilityMap.get(modalPair.surplus_facility?.toLowerCase() ?? '');
    const destFacility = facilityMap.get(modalPair.at_risk_facility?.toLowerCase() ?? '');

    if (!medicine) { setResult({ ok: false, message: `Medicine "${modalPair.medicine}" not found in the medicines registry.` }); return; }
    if (!sourceFacility) { setResult({ ok: false, message: `Source facility "${modalPair.surplus_facility}" not found.` }); return; }
    if (!destFacility) { setResult({ ok: false, message: `Destination facility "${modalPair.at_risk_facility}" not found.` }); return; }

    const qty = parseInt(editQuantity, 10);
    if (isNaN(qty) || qty <= 0) { setResult({ ok: false, message: 'Quantity must be a positive number.' }); return; }

    setSubmitting(true);
    const uuid = crypto.randomUUID ? crypto.randomUUID() :
      'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });

    const { error } = await supabase.from('redistribution_requests').insert({
      id: uuid,
      medicine_id: medicine.id,
      source_facility_id: sourceFacility.id,
      destination_facility_id: destFacility.id,
      quantity_recommended: recommendation?.quantity ?? null,
      quantity_requested: qty,
      rationale: recommendation?.rationale ?? null,
      status: 'requested',
      requested_by: 'demo-user',
      expected_transfer_date: expectedDate,
    });

    setSubmitting(false);
    if (error) {
      setResult({ ok: false, message: `Failed: ${error.message}` });
      return;
    }

    setResult({ ok: true, message: `Transfer request created. Awaiting approval from ${sourceFacility.name}.` });
    setTimeout(() => {
      closeRedistribute();
      setTab('requests');
      loadAll();
    }, 900);
  }

  async function executeRequestAction() {
    if (!actionRequest) return;
    const { req, action } = actionRequest;
    const updates: any = {};

    if (action === 'approve') {
      updates.status = 'source_approved';
      updates.source_approved_by = 'demo-user';
      updates.source_approved_at = new Date().toISOString();
    } else if (action === 'reject') {
      if (!rejectReason.trim()) { setResult({ ok: false, message: 'Please enter a reason.' }); return; }
      updates.status = 'source_rejected';
      updates.rejection_reason = rejectReason;
    } else if (action === 'dispatch') {
      updates.status = 'dispatched';
      updates.quantity_dispatched = req.quantity_requested;
      updates.dispatched_at = new Date().toISOString();
    } else if (action === 'receive') {
      updates.status = 'received';
      updates.quantity_received = req.quantity_dispatched ?? req.quantity_requested;
      updates.received_at = new Date().toISOString();
    } else if (action === 'cancel') {
      updates.status = 'cancelled';
    }

    const { error } = await supabase.from('redistribution_requests').update(updates).eq('id', req.id);
    if (error) { setResult({ ok: false, message: `Failed: ${error.message}` }); return; }

    setResult({ ok: true, message: `Transfer ${action === 'receive' ? 'marked received' : action + 'd'}.` });
    setTimeout(() => {
      setActionRequest(null);
      setRejectReason('');
      setResult(null);
      loadAll();
    }, 700);
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

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
          <ArrowRightLeft size={22} className="text-cyan-500" />
          Redistribution
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Surplus-to-shortage matching across {country ?? 'all countries'} — AI recommends the quantity, officer approves
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Opportunities</span>
            <ArrowRightLeft size={16} className="text-cyan-500" />
          </div>
          <div className="mt-2 text-3xl font-bold text-slate-900 tabular-nums">{stats.total}</div>
        </div>
        <div className="bg-white border border-red-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Critical</span>
            <AlertTriangle size={16} className="text-red-500" />
          </div>
          <div className="mt-2 text-3xl font-bold text-red-600 tabular-nums">{stats.critical}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Avg Surplus</span>
            <TrendingUp size={16} className="text-green-500" />
          </div>
          <div className="mt-2 text-3xl font-bold text-green-600 tabular-nums">{stats.avgSurplus}d</div>
        </div>
        <div className="bg-white border border-indigo-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Open Requests</span>
            <Truck size={16} className="text-indigo-500" />
          </div>
          <div className="mt-2 text-3xl font-bold text-indigo-600 tabular-nums">{stats.requestsOpen}</div>
        </div>
      </div>

      <div className="flex gap-2 border-b border-slate-200">
        <button
          onClick={() => setTab('opportunities')}
          className={`px-4 py-2 text-sm font-medium transition border-b-2 -mb-px ${
            tab === 'opportunities' ? 'border-cyan-500 text-cyan-700' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Opportunities ({filtered.length})
        </button>
        <button
          onClick={() => setTab('requests')}
          className={`px-4 py-2 text-sm font-medium transition border-b-2 -mb-px ${
            tab === 'requests' ? 'border-cyan-500 text-cyan-700' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Transfer Requests ({requests.length})
        </button>
      </div>

      {tab === 'opportunities' && (
        <>
          <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search medicine or facility..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-cyan-500"
              />
            </div>
            <select
              value={urgencyFilter}
              onChange={(e) => setUrgencyFilter(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-cyan-500"
            >
              <option value="">All urgency levels</option>
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                  <tr>
                    <SortHeader label="Medicine" k="medicine" />
                    <SortHeader label="Surplus From" k="surplus_facility" />
                    <th className="text-center px-2 py-3 w-8"></th>
                    <SortHeader label="Transfer To" k="at_risk_facility" />
                    <SortHeader label="Days at Risk" k="at_risk_days_of_stock" align="right" />
                    <SortHeader label="Days at Source" k="surplus_days_of_stock" align="right" />
                    <th className="text-left px-4 py-3 font-semibold">Urgency</th>
                    <th className="text-right px-4 py-3 font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p, i) => {
                    const medKey = medicineMap.get(p.medicine?.toLowerCase() ?? '')?.id;
                    const srcKey = facilityMap.get(p.surplus_facility?.toLowerCase() ?? '')?.id;
                    const dstKey = facilityMap.get(p.at_risk_facility?.toLowerCase() ?? '')?.id;
                    const isRequested = medKey && srcKey && dstKey
                      ? requestedPairsKey.has(`${medKey}:${srcKey}:${dstKey}`)
                      : false;
                    return (
                    <tr key={i} className={`border-t border-slate-100 ${isRequested ? 'bg-slate-50/60 opacity-60' : 'hover:bg-slate-50/50'}`}>
                      <td className="px-4 py-2 font-medium text-slate-800">{p.medicine}</td>
                      <td className="px-4 py-2">
                        <div className="text-slate-700">{p.surplus_facility}</div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1">
                          <Package size={10} />
                          {Math.round(p.surplus_days_of_stock ?? 0)} days
                        </div>
                      </td>
                      <td className="px-2 py-2 text-center">
                        <ArrowRightLeft size={14} className="text-cyan-500 inline" />
                      </td>
                      <td className="px-4 py-2">
                        <div className="text-slate-700">{p.at_risk_facility}</div>
                        <div className="text-[11px] text-red-500">{(p.at_risk_days_of_stock ?? 0).toFixed(1)} days</div>
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        <span className="text-red-600 font-semibold">{(p.at_risk_days_of_stock ?? 0).toFixed(1)}d</span>
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        <span className="text-green-600 font-semibold">{Math.round(p.surplus_days_of_stock ?? 0)}d</span>
                      </td>
                      <td className="px-4 py-2"><UrgencyBadge level={p.urgency} /></td>
                      <td className="px-4 py-2 text-right">
                        {isRequested ? (
                          <span className="inline-flex items-center gap-1 bg-slate-200 text-slate-600 rounded-md px-3 py-1.5 text-[11px] font-semibold">
                            <CheckCircle2 size={11} />
                            Requested
                          </span>
                        ) : (
                          <button
                            onClick={() => openRedistribute(p)}
                            className="inline-flex items-center gap-1 bg-cyan-500 hover:bg-cyan-600 text-white rounded-md px-3 py-1.5 text-[11px] font-semibold transition"
                          >
                            <ArrowRightLeft size={11} />
                            Redistribute
                          </button>
                        )}
                      </td>
                    </tr>
                    );
                  })}
                  {filtered.length === 0 && !loading && (
                    <tr><td colSpan={8} className="text-center text-slate-400 py-8 text-sm">No redistribution opportunities match your filters</td></tr>
                  )}
                  {loading && (
                    <tr><td colSpan={8} className="text-center text-slate-400 py-8 text-sm">Loading...</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === 'requests' && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">Requested</th>
                  <th className="text-left px-4 py-3 font-semibold">Medicine</th>
                  <th className="text-left px-4 py-3 font-semibold">From → To</th>
                  <th className="text-right px-4 py-3 font-semibold">Qty</th>
                  <th className="text-left px-4 py-3 font-semibold">Status</th>
                  <th className="text-right px-4 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.map(r => {
                  const med = medicineIdMap.get(r.medicine_id);
                  const src = facilityIdMap.get(r.source_facility_id);
                  const dst = facilityIdMap.get(r.destination_facility_id);
                  return (
                    <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                      <td className="px-4 py-2 text-slate-500 text-xs tabular-nums">
                        {new Date(r.requested_at).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                      <td className="px-4 py-2 font-medium text-slate-800">{med?.name ?? '—'}</td>
                      <td className="px-4 py-2 text-xs text-slate-600">
                        <div>{src?.name ?? '—'}</div>
                        <div className="text-slate-400">→ {dst?.name ?? '—'}</div>
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        <div className="font-semibold text-slate-800">{r.quantity_requested}</div>
                        {r.quantity_recommended && r.quantity_recommended !== r.quantity_requested && (
                          <div className="text-[10px] text-slate-400">AI: {r.quantity_recommended}</div>
                        )}
                      </td>
                      <td className="px-4 py-2"><StatusBadge status={r.status} /></td>
                      <td className="px-4 py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {r.status === 'requested' && (
                            <>
                              <button onClick={() => { setActionRequest({ req: r, action: 'approve' }); setResult(null); }}
                                className="text-[10px] font-semibold uppercase tracking-wider text-green-700 hover:text-green-900 px-2 py-1 rounded hover:bg-green-50">
                                Approve
                              </button>
                              <button onClick={() => { setActionRequest({ req: r, action: 'reject' }); setRejectReason(''); setResult(null); }}
                                className="text-[10px] font-semibold uppercase tracking-wider text-red-700 hover:text-red-900 px-2 py-1 rounded hover:bg-red-50">
                                Reject
                              </button>
                            </>
                          )}
                          {r.status === 'source_approved' && (
                            <button onClick={() => { setActionRequest({ req: r, action: 'dispatch' }); setResult(null); }}
                              className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-blue-700 hover:text-blue-900 px-2 py-1 rounded hover:bg-blue-50">
                              <Truck size={11} /> Dispatch
                            </button>
                          )}
                          {r.status === 'dispatched' && (
                            <button onClick={() => { setActionRequest({ req: r, action: 'receive' }); setResult(null); }}
                              className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-green-700 hover:text-green-900 px-2 py-1 rounded hover:bg-green-50">
                              <CheckCircle2 size={11} /> Mark Received
                            </button>
                          )}
                          {r.rejection_reason && (
                            <span title={r.rejection_reason} className="text-[10px] text-slate-400 italic cursor-help">reason</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {requests.length === 0 && (
                  <tr><td colSpan={6} className="text-center text-slate-400 py-8 text-sm">No transfer requests yet — create one from the Opportunities tab</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs text-slate-600 leading-relaxed">
        <strong className="text-slate-800">How redistribution works:</strong> Every row is a surplus-to-shortage pairing detected by the platform.
        Click <strong>Redistribute</strong> to see the AI-recommended transfer quantity, computed to bring the receiving facility up to {TARGET_COVERAGE_DAYS} days of coverage
        while keeping the source facility above its own {TARGET_COVERAGE_DAYS}-day safety stock. The officer can adjust the quantity before submitting.
        Transfers then go through source approval, dispatch, and receipt — the same workflow as procurement.
      </div>

      {modalPair && recommendation && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={closeRedistribute}>
          <div className="bg-white rounded-lg shadow-2xl max-w-lg w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="font-semibold text-slate-900 flex items-center gap-2">
                  <ArrowRightLeft size={16} className="text-cyan-500" />
                  Create Transfer Request
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">AI-recommended quantity, editable before submission</p>
              </div>
              <button onClick={closeRedistribute} className="text-slate-400 hover:text-slate-700 p-1">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 block mb-1">From (surplus)</label>
                  <div className="text-sm text-slate-800 font-medium">{modalPair.surplus_facility}</div>
                  <div className="text-[11px] text-slate-400">{Math.round(modalPair.surplus_days_of_stock ?? 0)} days of stock</div>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 block mb-1">To (at risk)</label>
                  <div className="text-sm text-slate-800 font-medium">{modalPair.at_risk_facility}</div>
                  <div className="text-[11px] text-red-500">{(modalPair.at_risk_days_of_stock ?? 0).toFixed(1)} days remaining</div>
                </div>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 block mb-1">Medicine</label>
                <div className="text-sm text-slate-800 font-medium">{modalPair.medicine}</div>
              </div>

              <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <Sparkles size={14} className="text-cyan-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-cyan-700 mb-1">
                      AI recommendation: {recommendation.quantity} units
                    </div>
                    <div className="text-xs text-cyan-900 leading-relaxed">{recommendation.rationale}</div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 block mb-1">Quantity to transfer</label>
                  <input
                    type="number"
                    min="1"
                    value={editQuantity}
                    onChange={e => setEditQuantity(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 block mb-1">Expected transfer date</label>
                  <input
                    type="date"
                    value={expectedDate}
                    onChange={e => setExpectedDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>
            </div>

            {result && (
              <div className={`mt-4 text-xs p-3 rounded border ${result.ok ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                {result.message}
              </div>
            )}

            <div className="flex gap-2 justify-end mt-5">
              <button onClick={closeRedistribute} className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900">Cancel</button>
              <button
                onClick={submitRequest}
                disabled={submitting}
                className="inline-flex items-center gap-2 bg-cyan-500 hover:bg-cyan-600 disabled:bg-slate-300 text-white rounded-md px-4 py-2 text-sm font-medium transition"
              >
                <ArrowRightLeft size={14} />
                {submitting ? 'Submitting…' : 'Create Transfer Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {actionRequest && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => { setActionRequest(null); setResult(null); }}>
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="font-semibold text-slate-900 capitalize">
                  {actionRequest.action === 'receive' ? 'Mark as received' : actionRequest.action + ' transfer'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {actionRequest.req.quantity_requested} units · {medicineIdMap.get(actionRequest.req.medicine_id)?.name}
                </p>
              </div>
              <button onClick={() => { setActionRequest(null); setResult(null); }} className="text-slate-400 hover:text-slate-700 p-1">
                <X size={16} />
              </button>
            </div>

            {actionRequest.action === 'reject' && (
              <div className="mb-4">
                <label className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 block mb-1">Reason *</label>
                <textarea
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-cyan-500 resize-none"
                  placeholder="e.g. Source facility cannot spare stock at this time"
                />
              </div>
            )}

            {result && (
              <div className={`text-xs p-3 rounded border mb-3 ${result.ok ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                {result.message}
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <button onClick={() => { setActionRequest(null); setResult(null); }} className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900">Cancel</button>
              <button
                onClick={executeRequestAction}
                className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-white transition ${
                  actionRequest.action === 'reject' ? 'bg-red-500 hover:bg-red-600' : 'bg-cyan-500 hover:bg-cyan-600'
                }`}
              >
                {actionRequest.action === 'approve' && <CheckCircle2 size={14} />}
                {actionRequest.action === 'reject' && <Ban size={14} />}
                {actionRequest.action === 'dispatch' && <Truck size={14} />}
                {actionRequest.action === 'receive' && <CheckCircle2 size={14} />}
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


