export type ReportKind = 'situation' | 'forecast' | 'advisory';

export interface ReportHistoryEntry {
  id: string;
  kind: ReportKind;
  label: string;
  country: string;
  window?: string;
  generatedAt: string;
  format: string;
  summaryIncluded: boolean;
  payload?: {
    question?: string;
    conversation?: { role: 'user' | 'assistant'; content: string }[];
    windowStart?: string;
    windowEnd?: string;
  };
}

const STORAGE_KEY = 'medisignal.report-history';

export function getReportHistory(): ReportHistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.map((e: any) => ({
      id: e.id ?? `legacy-${Math.random().toString(36).slice(2)}`,
      kind: e.kind ?? 'situation',
      label: e.label ?? 'Situation Report',
      country: e.country ?? 'All Africa',
      window: e.window,
      generatedAt: e.generatedAt ?? new Date().toISOString(),
      format: e.format ?? 'HTML → PDF',
      summaryIncluded: !!e.summaryIncluded,
      payload: e.payload ?? undefined,
    }));
  } catch {
    return [];
  }
}

export function addReportHistory(
  entry: Omit<ReportHistoryEntry, 'id' | 'generatedAt'> & { generatedAt?: string }
): string {
  try {
    const existing = getReportHistory();
    const id = `report-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const full: ReportHistoryEntry = {
      id,
      generatedAt: entry.generatedAt ?? new Date().toISOString(),
      ...entry,
    };
    existing.unshift(full);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing.slice(0, 100)));
    window.dispatchEvent(new Event('medisignal-report-added'));
    return id;
  } catch {
    return '';
  }
}

export function clearReportHistory(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event('medisignal-report-added'));
  } catch {}
}
