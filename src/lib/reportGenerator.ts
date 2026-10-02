import type { ShortageRadarRow, Facility } from '../types';

interface ExportParams {
  country: string | null;
  radarData: ShortageRadarRow[];
  facilities: Facility[];
  supplyContext: any;
  summary: string;
  summaryError?: string;
}

function esc(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function riskColor(risk: string): string {
  switch (risk) {
    case 'Critical': return '#dc2626';
    case 'High': return '#ea580c';
    case 'Medium': return '#ca8a04';
    case 'Low': return '#16a34a';
    default: return '#64748b';
  }
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  try {
    const dt = new Date(d);
    return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return d; }
}

const rank: Record<string, number> = { Critical: 4, High: 3, Medium: 2, Low: 1 };

export function generateReportHTML(params: ExportParams): string {
  const { country, radarData, supplyContext, summary, summaryError } = params;

  const countryName = country ?? 'Africa (All Countries)';
  const countrySlug = country ?? 'Africa';
  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  // KPIs
  const criticalMedicines = new Set<string>();
  const criticalFacilities = new Set<string>();
  let stockoutsNext14 = 0;
  const now = new Date();
  const in14 = new Date(now.getTime() + 14 * 86400000);

  for (const row of radarData) {
    if (row.risk_level === 'Critical') {
      criticalMedicines.add(row.medicine_id);
      criticalFacilities.add(row.facility_id);
    }
    if (row.projected_stockout_date) {
      const d = new Date(row.projected_stockout_date);
      if (d <= in14) stockoutsNext14++;
    }
  }

  // Medicines at risk
  const medicineMap = new Map<string, { name: string; category: string; facilities: Set<string>; earliest: string | null; worst: string }>();
  for (const row of radarData) {
    if (!medicineMap.has(row.medicine_id)) {
      medicineMap.set(row.medicine_id, {
        name: row.medicine_name,
        category: row.medicine_category,
        facilities: new Set(),
        earliest: null,
        worst: 'Low',
      });
    }
    const e = medicineMap.get(row.medicine_id)!;
    if (row.risk_level === 'Critical' || row.risk_level === 'High') e.facilities.add(row.facility_id);
    if (row.projected_stockout_date && (!e.earliest || row.projected_stockout_date < e.earliest)) e.earliest = row.projected_stockout_date;
    if ((rank[row.risk_level] ?? 0) > (rank[e.worst] ?? 0)) e.worst = row.risk_level;
  }
  const medicinesAtRisk = Array.from(medicineMap.values())
    .filter(m => m.worst === 'Critical' || m.worst === 'High')
    .sort((a, b) => (rank[b.worst] - rank[a.worst]) || (b.facilities.size - a.facilities.size))
    .slice(0, 10);

  // Facilities at risk
  const facilityMap = new Map<string, { name: string; district: string; critical: number; high: number; worst: string }>();
  for (const row of radarData) {
    if (!facilityMap.has(row.facility_id)) {
      facilityMap.set(row.facility_id, { name: row.facility_name, district: row.district, critical: 0, high: 0, worst: 'Low' });
    }
    const e = facilityMap.get(row.facility_id)!;
    if (row.risk_level === 'Critical') e.critical++;
    if (row.risk_level === 'High') e.high++;
    if ((rank[row.risk_level] ?? 0) > (rank[e.worst] ?? 0)) e.worst = row.risk_level;
  }
  const facilitiesAtRisk = Array.from(facilityMap.values())
    .filter(f => f.critical > 0 || f.high > 0)
    .sort((a, b) => (b.critical - a.critical) || (b.high - a.high))
    .slice(0, 10);

  // Hotspots
  const districtMap = new Map<string, { facilities: Set<string>; medicines: Set<string> }>();
  for (const row of radarData) {
    if (row.risk_level !== 'Critical' && row.risk_level !== 'High') continue;
    if (!districtMap.has(row.district)) districtMap.set(row.district, { facilities: new Set(), medicines: new Set() });
    const e = districtMap.get(row.district)!;
    e.facilities.add(row.facility_id);
    e.medicines.add(row.medicine_name);
  }
  const hotspots = Array.from(districtMap.entries())
    .map(([district, v]) => ({ district, facilityCount: v.facilities.size, medicines: Array.from(v.medicines) }))
    .sort((a, b) => b.facilityCount - a.facilityCount)
    .slice(0, 10);

  // Redistribution + Procurement from context
  const redistribution = supplyContext?.redistribution_opportunities ?? [];
  const procurement = supplyContext?.procurement_risks?.top_delayed ?? [];

  const summaryHtml = summaryError
    ? `<p style="font-style:italic;color:#dc2626;">${esc(summaryError)}</p>`
    : summary
    ? summary.split(/\n\s*\n/).map(p => `<p>${esc(p.trim())}</p>`).join('')
    : `<p style="font-style:italic;color:#64748b;">Executive summary not available.</p>`;

  const footer = (page: number) => `
    <div class="footer">
      <div>Medisignal Africa · ${esc(countryName)} · Demonstration Data · Page ${page} of 6</div>
      <div style="font-size:8px;margin-top:2px;color:#9ca3af;letter-spacing:0.04em;">
        DEMONSTRATION DATA — SYNTHETIC · NOT OFFICIAL GOVERNMENT RECORDS
      </div>
    </div>`;

  const medicineRows = medicinesAtRisk.map(m => `
    <tr>
      <td><strong>${esc(m.name)}</strong></td>
      <td>${esc(m.category)}</td>
      <td class="num">${m.facilities.size}</td>
      <td>${esc(fmtDate(m.earliest))}</td>
      <td style="color:${riskColor(m.worst)};font-weight:700;">${esc(m.worst)}</td>
    </tr>`).join('') || '<tr><td colspan="5" style="text-align:center;color:#64748b;">No critical or high-risk medicines</td></tr>';

  const facilityRows = facilitiesAtRisk.map(f => `
    <tr>
      <td><strong>${esc(f.name)}</strong></td>
      <td>${esc(f.district)}</td>
      <td class="num" style="color:#dc2626;font-weight:600;">${f.critical}</td>
      <td class="num" style="color:#ea580c;">${f.high}</td>
      <td style="color:${riskColor(f.worst)};font-weight:700;">${esc(f.worst)}</td>
    </tr>`).join('') || '<tr><td colspan="5" style="text-align:center;color:#64748b;">No facilities at risk</td></tr>';

  const hotspotRows = hotspots.map(h => `
    <tr>
      <td><strong>${esc(h.district)}</strong></td>
      <td class="num">${h.facilityCount}</td>
      <td>${esc(h.medicines.slice(0, 4).join(', '))}${h.medicines.length > 4 ? '…' : ''}</td>
    </tr>`).join('') || '<tr><td colspan="3" style="text-align:center;color:#64748b;">No emerging hotspots</td></tr>';

  const redistributionRows = redistribution.map((r: any) => `
    <tr>
      <td><strong>${esc(r.medicine)}</strong></td>
      <td>${esc(r.surplus_facility)}</td>
      <td>${esc(r.at_risk_facility)}</td>
      <td class="num" style="color:#dc2626;font-weight:600;">${r.at_risk_days_of_stock?.toFixed?.(1) ?? '—'}d</td>
      <td class="num" style="color:#16a34a;">${r.surplus_days_of_stock?.toFixed?.(0) ?? '—'}d</td>
      <td style="color:${riskColor(r.urgency)};font-weight:700;">${esc(r.urgency)}</td>
    </tr>`).join('') || '<tr><td colspan="6" style="text-align:center;color:#64748b;">No active redistribution pairings found</td></tr>';

  const procurementRows = procurement.map((p: any) => `
    <tr>
      <td><strong>${esc(p.facility)}</strong></td>
      <td>${esc(p.medicine)}</td>
      <td>${esc(fmtDate(p.expected_delivery))}</td>
      <td class="num" style="color:#dc2626;font-weight:600;">${p.days_overdue}d</td>
      <td class="num">${p.quantity_ordered}</td>
    </tr>`).join('') || '<tr><td colspan="5" style="text-align:center;color:#64748b;">No delayed purchase orders registered</td></tr>';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(countrySlug)} Medicine Supply Situation Report</title>
<style>
  @page { size: A4; margin: 0; }
  body { margin: 0; font-family: Georgia, 'Times New Roman', serif; color: #111; background: #f5f5f5; }
  .print-bar { position: sticky; top: 0; background: #0f172a; color: white; padding: 12px 20px; display: flex; justify-content: space-between; align-items: center; z-index: 10; font-family: Helvetica, Arial, sans-serif; box-shadow: 0 2px 8px rgba(0,0,0,0.15); }
  .print-bar button { background: #06b6d4; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 13px; }
  .print-bar button:hover { background: #0891b2; }
  .page { width: 210mm; min-height: 297mm; padding: 20mm; box-sizing: border-box; background: white; margin: 20px auto; page-break-after: always; position: relative; box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
  .page:last-child { page-break-after: auto; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; font-family: Helvetica, Arial, sans-serif; margin-bottom: 20px; }
  th { background: #f3f4f6; text-align: left; padding: 6px 8px; border-bottom: 1px solid #9ca3af; font-weight: 600; }
  td { padding: 6px 8px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  h2 { font-size: 20px; letter-spacing: 0.05em; padding-bottom: 6px; border-bottom: 1px solid #06b6d4; margin-bottom: 16px; margin-top: 0; }
  .footer { position: absolute; bottom: 12mm; left: 20mm; right: 20mm; font-size: 9px; color: #6b7280; text-align: center; border-top: 1px solid #e5e7eb; padding-top: 6px; font-family: Helvetica, Arial, sans-serif; }
  .kpi-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 24px; }
  .kpi-card { border: 1px solid #e2e8f0; border-radius: 4px; padding: 10px 14px; background: #f8fafc; font-family: Helvetica, Arial, sans-serif; }
  .kpi-title { font-size: 9px; font-weight: 700; letter-spacing: 0.08em; color: #64748b; text-transform: uppercase; }
  .kpi-val { font-size: 24px; font-weight: 700; color: #0f172a; margin-top: 4px; font-family: monospace; }
  .footnote { margin-top: 16px; font-size: 10px; font-style: italic; color: #64748b; font-family: Helvetica, Arial, sans-serif; }
  .summary p { font-size: 15px; line-height: 1.8; text-align: justify; margin: 0 0 16px 0; }
  @media print {
    body { background: white; }
    .print-bar { display: none; }
    .page { margin: 0; box-shadow: none; width: 100%; min-height: 297mm; }
  }
</style>
</head>
<body>
<div class="print-bar">
  <div style="font-weight: 600; font-size: 14px;">Medisignal Africa · ${esc(countryName)} Situation Report</div>
  <button onclick="window.print()">Print / Save as PDF</button>
</div>

<!-- PAGE 1: COVER -->
<div class="page" style="display:flex;flex-direction:column;justify-content:space-between;">
  <div>
    <div style="font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#0891b2;font-weight:700;font-family:Helvetica,Arial,sans-serif;">MEDISIGNAL AFRICA</div>
    <div style="margin-top:70mm;">
      <h1 style="font-size:38px;line-height:1.15;font-weight:700;margin:0;color:#0f172a;">${esc(countryName)} Medicine Supply Situation Report</h1>
      <p style="font-size:16px;color:#475569;margin-top:12px;font-weight:500;font-family:Helvetica,Arial,sans-serif;">National Shortage Radar Analysis</p>
      <div style="border-bottom:1px solid #06b6d4;margin-top:20px;margin-bottom:20px;"></div>
      <p style="font-size:13px;color:#334155;">Generated ${esc(today)}</p>
      <p style="font-size:10px;text-transform:uppercase;letter-spacing:0.15em;color:#94a3b8;margin-top:8px;font-weight:600;font-family:Helvetica,Arial,sans-serif;">DEMONSTRATION DATA — SYNTHETIC</p>
    </div>
  </div>
  <div style="border-top:1px solid #cbd5e1;padding-top:10px;font-size:10px;color:#64748b;font-family:Helvetica,Arial,sans-serif;">
    Generated by Medisignal Africa · Africa IGF Secretariat · United Nations Economic Commission for Africa
  </div>
  ${footer(1)}
</div>

<!-- PAGE 2: EXECUTIVE SUMMARY -->
<div class="page">
  <h2>Executive Summary</h2>
  <div class="summary">${summaryHtml}</div>
  <div style="margin-top:30px;font-size:10px;font-style:italic;color:#64748b;border-top:1px dashed #cbd5e1;padding-top:8px;font-family:Helvetica,Arial,sans-serif;">
    AI-generated summary based on real-time supply snapshot. All figures are Demonstration Data.
  </div>
  ${footer(2)}
</div>

<!-- PAGE 3: NATIONAL SITUATION -->
<div class="page">
  <h2>1. National Situation</h2>
  <div class="kpi-grid">
    <div class="kpi-card"><div class="kpi-title">Critical Medicines</div><div class="kpi-val">${criticalMedicines.size}</div></div>
    <div class="kpi-card"><div class="kpi-title">Critical Facilities</div><div class="kpi-val">${criticalFacilities.size}</div></div>
    <div class="kpi-card"><div class="kpi-title">Projected Stockouts (14 Days)</div><div class="kpi-val">${stockoutsNext14}</div></div>
    <div class="kpi-card"><div class="kpi-title">Redistribution Opportunities</div><div class="kpi-val">${redistribution.length}</div></div>
  </div>
  <h3 style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#334155;margin-bottom:8px;font-family:Helvetica,Arial,sans-serif;">Medicines at Risk</h3>
  <table>
    <thead><tr><th>Medicine</th><th>Category</th><th class="num">Facilities at Risk</th><th>Earliest Stockout</th><th>Worst Risk</th></tr></thead>
    <tbody>${medicineRows}</tbody>
  </table>
  ${footer(3)}
</div>

<!-- PAGE 4: FACILITIES & HOTSPOTS -->
<div class="page">
  <h2>2. Facilities at Risk</h2>
  <table>
    <thead><tr><th>Facility</th><th>District</th><th class="num">Critical</th><th class="num">High</th><th>Worst Risk</th></tr></thead>
    <tbody>${facilityRows}</tbody>
  </table>
  <h2 style="margin-top:24px;">3. Emerging Hotspots</h2>
  <table>
    <thead><tr><th>District</th><th class="num">At-Risk Facilities</th><th>Medicines Affected</th></tr></thead>
    <tbody>${hotspotRows}</tbody>
  </table>
  ${footer(4)}
</div>

<!-- PAGE 5: REDISTRIBUTION -->
<div class="page">
  <h2>4. Redistribution Opportunities</h2>
  <table>
    <thead><tr><th>Medicine</th><th>Surplus Facility</th><th>At-Risk Facility</th><th class="num">Days at Risk</th><th class="num">Days at Surplus</th><th>Urgency</th></tr></thead>
    <tbody>${redistributionRows}</tbody>
  </table>
  <div class="footnote">All transfers require authorisation by the receiving facility's supply chain officer.</div>
  ${footer(5)}
</div>

<!-- PAGE 6: PROCUREMENT -->
<div class="page">
  <h2>5. Procurement Risks</h2>
  <table>
    <thead><tr><th>Facility</th><th>Medicine</th><th>Expected Delivery</th><th class="num">Days Overdue</th><th class="num">Qty Ordered</th></tr></thead>
    <tbody>${procurementRows}</tbody>
  </table>
  <div class="footnote">Delayed orders are defined as past expected delivery date with quantity_received = 0.</div>
  ${footer(6)}
</div>

</body>
</html>`;
}

export function downloadReport(html: string, country: string | null): void {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const date = new Date().toISOString().slice(0, 10);
  const slug = (country ?? 'africa').toLowerCase().replace(/\s+/g, '-');
  const a = document.createElement('a');
  a.href = url;
  a.download = `medisignal-${slug}-report-${date}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

