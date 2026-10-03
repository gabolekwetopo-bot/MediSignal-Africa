import { supabase } from '../supabase';
import { generateReportHTML, downloadReport } from './reportGenerator';
import { generateForecastHTML, downloadForecastReport } from './forecastReportGenerator';
import { generateAdvisorReportHTML, downloadAdvisorReport } from './advisorReportGenerator';
import type { ReportHistoryEntry } from './reportHistory';

/**
 * Regenerate a report from a history entry.
 * Refetches live data and calls the AI narrative function again.
 * Downloads the resulting HTML file.
 */
export async function regenerateReport(entry: ReportHistoryEntry): Promise<{ ok: boolean; error?: string }> {
  try {
    const country = entry.country === 'All Africa' ? null : entry.country;

    if (entry.kind === 'situation') {
      return await regenerateSituation(country);
    }
    if (entry.kind === 'forecast') {
      if (!entry.payload?.windowStart || !entry.payload?.windowEnd) {
        return { ok: false, error: 'Forecast window data not available for this entry.' };
      }
      return await regenerateForecast(
        country,
        entry.window ?? 'Forecast',
        new Date(entry.payload.windowStart),
        new Date(entry.payload.windowEnd)
      );
    }
    if (entry.kind === 'advisory') {
      if (!entry.payload?.question || !entry.payload?.conversation) {
        return { ok: false, error: 'Advisory briefing payload not available.' };
      }
      return await regenerateAdvisory(
        country,
        entry.payload.question,
        entry.payload.conversation
      );
    }
    return { ok: false, error: 'Unknown report kind.' };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Regeneration failed.' };
  }
}

async function regenerateSituation(country: string | null): Promise<{ ok: boolean; error?: string }> {
  const [radarRes, facRes] = await Promise.all([
    supabase.rpc('get_shortage_radar', { country_filter: country }),
    country
      ? supabase.from('facilities').select('id, name, district, region, country, facility_type, latitude, longitude').eq('country', country)
      : supabase.from('facilities').select('id, name, district, region, country, facility_type, latitude, longitude'),
  ]);
  if (radarRes.error) return { ok: false, error: radarRes.error.message };

  let summary = '';
  let summaryError: string | undefined;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);
    const resp = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-report-summary`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ country }),
        signal: controller.signal,
      }
    );
    clearTimeout(timeoutId);
    if (resp.ok) {
      const json = await resp.json();
      summary = json.summary || '';
      if (!summary) summaryError = 'Summary returned empty.';
    } else {
      summaryError = `Summary service returned HTTP ${resp.status}.`;
    }
  } catch {
    summaryError = 'Summary generation timed out.';
  }

  let supplyContext: any = null;
  try {
    const { data } = await supabase.rpc('get_supply_context', { country_filter: country });
    supplyContext = data;
  } catch {}

  const html = generateReportHTML({
    country,
    radarData: (radarRes.data ?? []) as any,
    facilities: (facRes.data ?? []) as any,
    supplyContext,
    summary,
    summaryError,
  });
  downloadReport(html, country);
  return { ok: true };
}

async function regenerateForecast(
  country: string | null,
  label: string,
  startDate: Date,
  endDate: Date
): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.rpc('get_shortage_radar', { country_filter: country });
  if (error) return { ok: false, error: error.message };

  const rows = ((data ?? []) as any[]).filter(r =>
    r.projected_stockout_date &&
    (r.risk_level === 'Critical' || r.risk_level === 'High') &&
    new Date(r.projected_stockout_date) >= startDate &&
    new Date(r.projected_stockout_date) < endDate
  );

  if (rows.length === 0) {
    return { ok: false, error: 'No events found in that window for this country. The situation may have changed.' };
  }

  let narrative = '';
  try {
    const context = {
      country: country ?? 'All Africa',
      window_label: label,
      window_start: startDate.toISOString().slice(0, 10),
      window_end: endDate.toISOString().slice(0, 10),
      total_events: rows.length,
      critical: rows.filter(r => r.risk_level === 'Critical').length,
      high: rows.filter(r => r.risk_level === 'High').length,
      facilities_affected: new Set(rows.map(r => r.facility_id)).size,
      medicines_affected: new Set(rows.map(r => r.medicine_id)).size,
      sample_events: rows.slice(0, 30).map(r => ({
        facility: r.facility_name,
        district: r.district,
        medicine: r.medicine_name,
        days_left: r.days_of_stock,
        stockout_date: r.projected_stockout_date,
        risk: r.risk_level,
      })),
    };
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    const resp = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-report-summary`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ country, forecast_context: context }),
        signal: controller.signal,
      }
    );
    clearTimeout(timeoutId);
    if (resp.ok) {
      const json = await resp.json();
      narrative = json.summary || '';
    }
  } catch {}

  if (!narrative) {
    narrative = `${rows.length} medicine stockout events are projected between ${startDate.toLocaleDateString('en-GB')} and ${endDate.toLocaleDateString('en-GB')}. Of these, ${rows.filter(r => r.risk_level === 'Critical').length} are Critical and ${rows.filter(r => r.risk_level === 'High').length} are High risk. Supply chain managers should prioritise redistribution from surplus facilities and escalate delayed procurement orders.`;
  }

  const html = generateForecastHTML({
    country,
    label,
    startDate,
    endDate,
    rows,
    narrative,
  });
  downloadForecastReport(html, country, label);
  return { ok: true };
}

async function regenerateAdvisory(
  country: string | null,
  question: string,
  conversation: { role: 'user' | 'assistant'; content: string }[]
): Promise<{ ok: boolean; error?: string }> {
  let supplyContext: any = null;
  try {
    const { data } = await supabase.rpc('get_supply_context', { country_filter: country });
    supplyContext = data;
  } catch {}

  let narrative = '';
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);
    const resp = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-advisor-report`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, conversation, country }),
        signal: controller.signal,
      }
    );
    clearTimeout(timeoutId);
    if (resp.ok) {
      const json = await resp.json();
      narrative = json.narrative || '';
    }
  } catch {}

  if (!narrative) {
    narrative = `This briefing summarises an advisory session regarding the medicine supply situation${country ? ` in ${country}` : ' across all covered countries'}. The session addressed the question: "${question}".\n\nFINDINGS:\n- See the supporting tables for the current at-risk medicines and facilities.\n- The supply snapshot was drawn directly from the live Medisignal database.\n\nACTIONS:\n- Review the medicines at risk table and prioritise redistribution where possible.\n- Escalate any delayed procurement orders that align with projected stockouts.`;
  }

  const html = generateAdvisorReportHTML({
    question,
    conversation,
    country,
    narrative,
    supplyContext,
    generatedAt: new Date().toISOString(),
  });
  downloadAdvisorReport(html, country);
  return { ok: true };
}
