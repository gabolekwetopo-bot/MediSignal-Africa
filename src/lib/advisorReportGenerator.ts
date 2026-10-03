import { REPORT_HEADER_LOCKUP } from './reportLogo';

interface AdvisorReportParams {
  question: string;
  conversation: { role: 'user' | 'assistant'; content: string }[];
  country: string | null;
  narrative: string;
  supplyContext: any;
  generatedAt: string;
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

function parseNarrative(narrative: string): { summary: string; findings: string[]; actions: string[] } {
  const summary: string[] = [];
  const findings: string[] = [];
  const actions: string[] = [];

  let section: 'summary' | 'findings' | 'actions' = 'summary';
  const lines = narrative.split('\n');

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (/^FINDINGS:?\s*$/i.test(line)) { section = 'findings'; continue; }
    if (/^ACTIONS:?\s*$/i.test(line)) { section = 'actions'; continue; }

    const bulletMatch = line.match(/^[-*•]\s+(.*)$/);
    if (bulletMatch) {
      const text = bulletMatch[1].trim();
      if (section === 'findings') findings.push(text);
      else if (section === 'actions') actions.push(text);
      else summary.push(text);
    } else {
      if (section === 'summary') summary.push(line);
      else if (section === 'findings') findings.push(line);
      else actions.push(line);
    }
  }

  return {
    summary: summary.join('\n\n'),
    findings,
    actions,
  };
}

export function generateAdvisorReportHTML(params: AdvisorReportParams): string {
  const { question, conversation, country, narrative, supplyContext, generatedAt } = params;

  const countryName = country ?? 'All Africa';
  const countrySlug = country ?? 'africa';
  const generated = new Date(generatedAt).toLocaleString('en-GB', { dateStyle: 'long', timeStyle: 'short' });

  const parsed = parseNarrative(narrative);

  // Pull tables from context
  const medicines = supplyContext?.top_at_risk_medicines ?? [];
  const facilities = supplyContext?.top_at_risk_facilities ?? [];
  const redistribution = supplyContext?.redistribution_opportunities ?? [];
  const procurement = supplyContext?.procurement_risks?.top_delayed ?? [];

  const medicinesHtml = medicines.length > 0 ? medicines.map((m: any) => `
    <tr>
      <td><strong>${esc(m.medicine)}</strong></td>
      <td>${esc(m.category)}</td>
      <td class="num">${esc(m.facilities_at_risk)}</td>
      <td>${esc(m.earliest_stockout)}</td>
      <td style="color:${riskColor(m.worst_risk)};font-weight:700;">${esc(m.worst_risk)}</td>
    </tr>`).join('') : '<tr><td colspan="5" style="text-align:center;color:#64748b;">No medicines at risk in this context</td></tr>';

  const facilitiesHtml = facilities.length > 0 ? facilities.map((f: any) => `
    <tr>
      <td><strong>${esc(f.facility)}</strong></td>
      <td>${esc(f.district)}</td>
      <td class="num" style="color:#dc2626;font-weight:600;">${esc(f.critical_medicines)}</td>
      <td class="num" style="color:#ea580c;">${esc(f.high_medicines)}</td>
      <td style="color:${riskColor(f.worst_risk)};font-weight:700;">${esc(f.worst_risk)}</td>
    </tr>`).join('') : '<tr><td colspan="5" style="text-align:center;color:#64748b;">No facilities at risk in this context</td></tr>';

  const redistributionHtml = redistribution.length > 0 ? redistribution.map((r: any) => `
    <tr>
      <td><strong>${esc(r.medicine)}</strong></td>
      <td>${esc(r.surplus_facility)}</td>
      <td>${esc(r.at_risk_facility)}</td>
      <td class="num" style="color:#dc2626;font-weight:600;">${(r.at_risk_days_of_stock ?? 0).toFixed(1)}d</td>
      <td class="num" style="color:#16a34a;">${Math.round(r.surplus_days_of_stock ?? 0)}d</td>
      <td style="color:${riskColor(r.urgency)};font-weight:700;">${esc(r.urgency)}</td>
    </tr>`).join('') : '<tr><td colspan="6" style="text-align:center;color:#64748b;">No redistribution opportunities</td></tr>';

  const procurementHtml = procurement.length > 0 ? procurement.map((p: any) => `
    <tr>
      <td><strong>${esc(p.facility)}</strong></td>
      <td>${esc(p.medicine)}</td>
      <td>${esc(p.expected_delivery)}</td>
      <td class="num" style="color:#dc2626;font-weight:600;">${esc(p.days_overdue)}d</td>
      <td class="num">${esc(p.quantity_ordered)}</td>
    </tr>`).join('') : '<tr><td colspan="5" style="text-align:center;color:#64748b;">No delayed orders</td></tr>';

  const summaryHtml = parsed.summary
    .split(/\n\s*\n/)
    .filter((p: string) => p.trim())
    .map((p: string) => `<p>${esc(p.trim())}</p>`)
    .join('');

  const findingsHtml = parsed.findings.length > 0
    ? `<ul>${parsed.findings.map((f: string) => `<li>${esc(f)}</li>`).join('')}</ul>`
    : '<p style="color:#64748b;font-style:italic;">No findings extracted.</p>';

  const actionsHtml = parsed.actions.length > 0
    ? `<ul>${parsed.actions.map((a: string) => `<li>${esc(a)}</li>`).join('')}</ul>`
    : '<p style="color:#64748b;font-style:italic;">No actions specified.</p>';

  const transcriptHtml = conversation.map(c => `
    <div style="margin-bottom:14px;page-break-inside:avoid;">
      <div style="font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${c.role === 'user' ? '#0891b2' : '#64748b'};margin-bottom:4px;">
        ${c.role === 'user' ? 'Question' : 'Medisignal AI'}
      </div>
      <div style="font-size:13px;line-height:1.7;color:#1e293b;white-space:pre-wrap;">${esc(c.content)}</div>
    </div>
    <div style="border-bottom:1px solid #e2e8f0;margin:14px 0;"></div>
  `).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(countrySlug)} Advisory Briefing</title>
<style>
  @page { size: A4; margin: 0; }
  body { margin: 0; font-family: Georgia, 'Times New Roman', serif; color: #111; background: #f5f5f5; }
  .print-bar { position: sticky; top: 0; background: #0f172a; color: white; padding: 12px 20px; display: flex; justify-content: space-between; align-items: center; z-index: 10; font-family: Helvetica, Arial, sans-serif; box-shadow: 0 2px 8px rgba(0,0,0,0.15); }
  .print-bar button { background: #06b6d4; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 13px; }
  .print-bar button:hover { background: #0891b2; }
  .page { width: 210mm; min-height: 297mm; padding: 20mm; box-sizing: border-box; background: white; margin: 20px auto; page-break-after: always; position: relative; box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
  .page:last-child { page-break-after: auto; }
  table { width: 100%; border-collapse: collapse; font-size: 10px; font-family: Helvetica, Arial, sans-serif; margin-bottom: 14px; }
  th { background: #f3f4f6; text-align: left; padding: 6px 8px; border-bottom: 1px solid #9ca3af; font-weight: 600; }
  td { padding: 6px 8px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  h2 { font-size: 16px; letter-spacing: 0.05em; padding-bottom: 6px; border-bottom: 1px solid #06b6d4; margin: 18px 0 12px 0; font-family: Helvetica, Arial, sans-serif; }
  h3 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: #334155; margin: 14px 0 6px 0; font-family: Helvetica, Arial, sans-serif; }
  .footer { position: absolute; bottom: 12mm; left: 20mm; right: 20mm; font-size: 9px; color: #6b7280; text-align: center; border-top: 1px solid #e5e7eb; padding-top: 6px; font-family: Helvetica, Arial, sans-serif; }
  .summary p { font-size: 13px; line-height: 1.75; text-align: justify; margin: 0 0 12px 0; }
  ul { margin: 0 0 12px 0; padding-left: 20px; font-size: 12px; line-height: 1.7; }
  li { margin-bottom: 4px; }
</style>
</head>
<body>
<div class="print-bar">
  <div style="font-weight: 600; font-size: 14px;">Medisignal Africa · ${esc(countryName)} Advisory Briefing</div>
  <button onclick="window.print()">Print / Save as PDF</button>
</div>

<!-- PAGE 1: COVER + SUMMARY -->
<div class="page">
  ${REPORT_HEADER_LOCKUP}
  <h1 style="font-size:24px;line-height:1.25;font-weight:700;margin:8px 0 6px 0;color:#0f172a;">${esc(countryName)} Medicine Supply Advisory Briefing</h1>
  <p style="font-size:13px;color:#475569;margin:0 0 4px 0;font-family:Helvetica,Arial,sans-serif;">Generated ${esc(generated)}</p>
  <p style="font-size:10px;text-transform:uppercase;letter-spacing:0.15em;color:#94a3b8;margin-top:6px;font-weight:600;font-family:Helvetica,Arial,sans-serif;">DEMONSTRATION DATA — SYNTHETIC</p>
  <div style="border-bottom:1px solid #06b6d4;margin:16px 0 20px 0;"></div>

  <h3 style="margin-top:0;">Question Addressed</h3>
  <div style="background:#f8fafc;border-left:3px solid #06b6d4;padding:10px 14px;font-size:13px;font-style:italic;color:#334155;margin-bottom:20px;">
    ${esc(question)}
  </div>

  <h2>Executive Summary</h2>
  <div class="summary">${summaryHtml || '<p style="color:#64748b;font-style:italic;">Summary could not be generated.</p>'}</div>

  <h2>Key Findings</h2>
  ${findingsHtml}

  <h2>Recommended Actions</h2>
  ${actionsHtml}

  <div class="footer"><div>Medisignal Africa · ${esc(countryName)} · Demonstration Data · Page 1</div>
    <div style="font-size:8px;margin-top:2px;color:#9ca3af;">AI-assisted briefing · All figures are Demonstration Data · Not official government records</div>
  </div>
</div>

<!-- PAGE 2: LIVE DATA TABLES -->
<div class="page">
  <h2 style="margin-top:0;">Supporting Data</h2>
  <p style="font-size:11px;color:#64748b;font-family:Helvetica,Arial,sans-serif;margin:0 0 16px 0;">
    These tables are drawn directly from the live supply snapshot at the time of generation. They are not AI-generated.
  </p>

  <h3>Medicines at Risk</h3>
  <table>
    <thead><tr><th>Medicine</th><th>Category</th><th class="num">Facilities at Risk</th><th>Earliest Stockout</th><th>Risk</th></tr></thead>
    <tbody>${medicinesHtml}</tbody>
  </table>

  <h3>Facilities at Risk</h3>
  <table>
    <thead><tr><th>Facility</th><th>District</th><th class="num">Critical</th><th class="num">High</th><th>Worst Risk</th></tr></thead>
    <tbody>${facilitiesHtml}</tbody>
  </table>

  <h3>Redistribution Opportunities</h3>
  <table>
    <thead><tr><th>Medicine</th><th>Surplus From</th><th>Transfer To</th><th class="num">Days at Risk</th><th class="num">Days at Source</th><th>Urgency</th></tr></thead>
    <tbody>${redistributionHtml}</tbody>
  </table>

  <h3>Delayed Procurement Orders</h3>
  <table>
    <thead><tr><th>Facility</th><th>Medicine</th><th>Expected</th><th class="num">Days Overdue</th><th class="num">Qty</th></tr></thead>
    <tbody>${procurementHtml}</tbody>
  </table>

  <div class="footer"><div>Medisignal Africa · ${esc(countryName)} · Demonstration Data · Page 2</div>
    <div style="font-size:8px;margin-top:2px;color:#9ca3af;">All figures are Demonstration Data · Not official government records</div>
  </div>
</div>

<!-- PAGE 3: TRANSCRIPT -->
<div class="page">
  <h2 style="margin-top:0;">Advisory Session Transcript</h2>
  <p style="font-size:11px;color:#64748b;font-family:Helvetica,Arial,sans-serif;margin:0 0 16px 0;">
    Full Q&amp;A record from the AI Supply Advisor session that produced this briefing.
  </p>

  ${transcriptHtml || '<p style="color:#64748b;font-style:italic;">No conversation recorded.</p>'}

  <div class="footer"><div>Medisignal Africa · ${esc(countryName)} · Demonstration Data · Page 3</div>
    <div style="font-size:8px;margin-top:2px;color:#9ca3af;">All figures are Demonstration Data · Not official government records</div>
  </div>
</div>

</body>
</html>`;
}

export function downloadAdvisorReport(html: string, country: string | null): void {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const date = new Date().toISOString().slice(0, 10);
  const slug = (country ?? 'africa').toLowerCase().replace(/\s+/g, '-');
  const a = document.createElement('a');
  a.href = url;
  a.download = `medisignal-advisory-${slug}-${date}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}




