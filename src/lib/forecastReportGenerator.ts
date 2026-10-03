import { REPORT_HEADER_LOCKUP } from './reportLogo';

interface ForecastRow {
  facility_id: string;
  facility_name: string;
  district: string;
  medicine_id: string;
  medicine_name: string;
  medicine_category: string;
  risk_level: string;
  days_of_stock: number | null;
  current_stock: number;
  projected_stockout_date: string | null;
}

interface ForecastReportParams {
  country: string | null;
  label: string;
  startDate: Date;
  endDate: Date;
  rows: ForecastRow[];
  narrative: string;
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

function fmt(d: Date | string | null): string {
  if (!d) return '—';
  const dt = typeof d === 'string' ? new Date(d) : d;
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function generateForecastHTML(params: ForecastReportParams): string {
  const { country, label, startDate, endDate, rows, narrative } = params;

  const countryName = country ?? 'All Africa';
  const countrySlug = country ?? 'africa';

  const criticalCount = rows.filter(r => r.risk_level === 'Critical').length;
  const highCount = rows.filter(r => r.risk_level === 'High').length;
  const facilitiesAffected = new Set(rows.map(r => r.facility_id)).size;
  const medicinesAffected = new Set(rows.map(r => r.medicine_id)).size;
  const districtsAffected = new Set(rows.map(r => r.district)).size;

  const rowsHtml = rows.map(r => `
    <tr>
      <td><strong>${esc(r.facility_name)}</strong><br><span style="color:#64748b;font-size:10px;">${esc(r.district)}</span></td>
      <td>${esc(r.medicine_name)}<br><span style="color:#64748b;font-size:10px;">${esc(r.medicine_category)}</span></td>
      <td class="num">${r.current_stock}</td>
      <td class="num">${r.days_of_stock != null ? r.days_of_stock.toFixed(1) + 'd' : '—'}</td>
      <td>${esc(fmt(r.projected_stockout_date))}</td>
      <td style="color:${riskColor(r.risk_level)};font-weight:700;">${esc(r.risk_level)}</td>
    </tr>
  `).join('');

  const narrativeHtml = narrative
    ? narrative.split(/\n\s*\n/).map(p => `<p>${esc(p.trim())}</p>`).join('')
    : `<p style="font-style:italic;color:#64748b;">Narrative summary unavailable. The table below lists the full set of projected stockout events for this window.</p>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(countryName)} Forecast · ${esc(label)}</title>
<style>
  @page { size: A4; margin: 0; }
  body { margin: 0; font-family: Georgia, 'Times New Roman', serif; color: #111; background: #f5f5f5; }
  .print-bar { position: sticky; top: 0; background: #0f172a; color: white; padding: 12px 20px; display: flex; justify-content: space-between; align-items: center; z-index: 10; font-family: Helvetica, Arial, sans-serif; box-shadow: 0 2px 8px rgba(0,0,0,0.15); }
  .print-bar button { background: #06b6d4; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 13px; }
  .print-bar button:hover { background: #0891b2; }
  .page { width: 210mm; min-height: 297mm; padding: 20mm; box-sizing: border-box; background: white; margin: 20px auto; page-break-after: always; position: relative; box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
  .page:last-child { page-break-after: auto; }
  table { width: 100%; border-collapse: collapse; font-size: 10px; font-family: Helvetica, Arial, sans-serif; margin-bottom: 20px; }
  th { background: #f3f4f6; text-align: left; padding: 6px 8px; border-bottom: 1px solid #9ca3af; font-weight: 600; }
  td { padding: 6px 8px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  h2 { font-size: 18px; letter-spacing: 0.05em; padding-bottom: 6px; border-bottom: 1px solid #06b6d4; margin-bottom: 14px; margin-top: 0; }
  .footer { position: absolute; bottom: 12mm; left: 20mm; right: 20mm; font-size: 9px; color: #6b7280; text-align: center; border-top: 1px solid #e5e7eb; padding-top: 6px; font-family: Helvetica, Arial, sans-serif; }
  .kpi-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 20px; }
  .kpi-card { border: 1px solid #e2e8f0; border-radius: 4px; padding: 8px 12px; background: #f8fafc; font-family: Helvetica, Arial, sans-serif; }
  .kpi-title { font-size: 9px; font-weight: 700; letter-spacing: 0.08em; color: #64748b; text-transform: uppercase; }
  .kpi-val { font-size: 22px; font-weight: 700; color: #0f172a; margin-top: 3px; font-family: monospace; }
  .summary p { font-size: 13px; line-height: 1.7; text-align: justify; margin: 0 0 12px 0; }
  @media print {
    body { background: white; }
    .print-bar { display: none; }
    .page { margin: 0; box-shadow: none; width: 100%; min-height: 297mm; }
  }
</style>
</head>
<body>
<div class="print-bar">
  <div style="font-weight: 600; font-size: 14px;">Medisignal Africa · ${esc(countryName)} Forecast · ${esc(label)}</div>
  <button onclick="window.print()">Print / Save as PDF</button>
</div>

<!-- PAGE 1: SUMMARY -->
<div class="page">
  ${REPORT_HEADER_LOCKUP}
  <h1 style="font-size:26px;line-height:1.2;font-weight:700;margin:0 0 6px 0;color:#0f172a;">${esc(countryName)} Medicine Stockout Forecast</h1>
  <p style="font-size:14px;color:#475569;margin:0 0 4px 0;font-family:Helvetica,Arial,sans-serif;">${esc(label)} · ${esc(fmt(startDate))} – ${esc(fmt(endDate))}</p>
  <div style="border-bottom:1px solid #06b6d4;margin:14px 0;"></div>

  <div class="kpi-grid">
    <div class="kpi-card"><div class="kpi-title">Projected Stockouts</div><div class="kpi-val">${rows.length}</div></div>
    <div class="kpi-card"><div class="kpi-title">Critical</div><div class="kpi-val" style="color:#dc2626;">${criticalCount}</div></div>
    <div class="kpi-card"><div class="kpi-title">High Risk</div><div class="kpi-val" style="color:#ea580c;">${highCount}</div></div>
    <div class="kpi-card"><div class="kpi-title">Facilities Affected</div><div class="kpi-val">${facilitiesAffected}</div></div>
    <div class="kpi-card"><div class="kpi-title">Medicines</div><div class="kpi-val">${medicinesAffected}</div></div>
    <div class="kpi-card"><div class="kpi-title">Districts</div><div class="kpi-val">${districtsAffected}</div></div>
  </div>

  <h2>Executive Summary</h2>
  <div class="summary">${narrativeHtml}</div>

  <div style="margin-top:20px;font-size:10px;font-style:italic;color:#64748b;border-top:1px dashed #cbd5e1;padding-top:8px;font-family:Helvetica,Arial,sans-serif;">
    AI-generated forecast narrative based on live supply data. All figures are Demonstration Data.
  </div>

  <div class="footer"><div>Medisignal Africa · ${esc(countryName)} · Demonstration Data · Page 1 of 2</div>
    <div style="font-size:8px;margin-top:2px;color:#9ca3af;letter-spacing:0.04em;">DEMONSTRATION DATA — SYNTHETIC · NOT OFFICIAL GOVERNMENT RECORDS</div>
  </div>
</div>

<!-- PAGE 2: TABLE -->
<div class="page">
  <h2>Facilities and Medicines at Risk — ${esc(label)}</h2>
  <table>
    <thead>
      <tr>
        <th>Facility</th>
        <th>Medicine</th>
        <th class="num">Current Stock</th>
        <th class="num">Days Left</th>
        <th>Projected Stockout</th>
        <th>Risk</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml || '<tr><td colspan="6" style="text-align:center;color:#64748b;">No projected stockouts in this window</td></tr>'}
    </tbody>
  </table>
  <div style="margin-top:14px;font-size:10px;font-style:italic;color:#64748b;font-family:Helvetica,Arial,sans-serif;">
    Projected stockout dates are computed from current inventory levels and average daily consumption. All transfers and orders require authorisation by the responsible supply chain officer.
  </div>

  <div class="footer"><div>Medisignal Africa · ${esc(countryName)} · Demonstration Data · Page 2 of 2</div>
    <div style="font-size:8px;margin-top:2px;color:#9ca3af;letter-spacing:0.04em;">DEMONSTRATION DATA — SYNTHETIC · NOT OFFICIAL GOVERNMENT RECORDS</div>
  </div>
</div>

</body>
</html>`;
}

export function downloadForecastReport(html: string, country: string | null, label: string): void {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const date = new Date().toISOString().slice(0, 10);
  const slug = (country ?? 'africa').toLowerCase().replace(/\s+/g, '-');
  const windowSlug = label.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  const a = document.createElement('a');
  a.href = url;
  a.download = `medisignal-forecast-${slug}-${windowSlug}-${date}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}




