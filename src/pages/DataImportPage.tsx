import { useEffect, useRef, useState } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle2, X, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../supabase';

type ImportType = 'inventory' | 'consumption' | 'procurement';

interface ImportLogRow {
  id: string;
  filename: string;
  import_type: string;
  row_count: number;
  valid_count: number;
  invalid_count: number;
  status: string;
  uploaded_by: string | null;
  created_at: string;
}

interface ParsedRow {
  raw: Record<string, string>;
  isValid: boolean;
  message?: string;
}

const EXPECTED_FIELDS: Record<ImportType, { key: string; label: string; required: boolean; aliases: string[] }[]> = {
  inventory: [
    { key: 'facility_name', label: 'Facility Name', required: true, aliases: ['facility', 'facility name', 'site', 'health facility'] },
    { key: 'medicine_name', label: 'Medicine Name', required: true, aliases: ['medicine', 'item', 'drug', 'commodity', 'product'] },
    { key: 'quantity', label: 'Quantity', required: true, aliases: ['stock', 'stock on hand', 'qty', 'balance', 'on hand'] },
    { key: 'batch_number', label: 'Batch Number', required: false, aliases: ['batch', 'lot', 'lot number'] },
    { key: 'expiry_date', label: 'Expiry Date', required: false, aliases: ['expiry', 'exp date', 'expires'] },
  ],
  consumption: [
    { key: 'facility_name', label: 'Facility Name', required: true, aliases: ['facility', 'facility name', 'site'] },
    { key: 'medicine_name', label: 'Medicine Name', required: true, aliases: ['medicine', 'item', 'drug', 'commodity'] },
    { key: 'quantity', label: 'Quantity Consumed', required: true, aliases: ['consumed', 'quantity', 'qty', 'usage', 'dispensed'] },
    { key: 'period_start', label: 'Period Start', required: true, aliases: ['start', 'from', 'period from'] },
    { key: 'period_end', label: 'Period End', required: true, aliases: ['end', 'to', 'period to'] },
  ],
  procurement: [
    { key: 'facility_name', label: 'Facility Name', required: true, aliases: ['facility', 'facility name', 'site'] },
    { key: 'medicine_name', label: 'Medicine Name', required: true, aliases: ['medicine', 'item', 'drug', 'commodity'] },
    { key: 'quantity_ordered', label: 'Quantity Ordered', required: true, aliases: ['qty ordered', 'ordered', 'quantity', 'qty'] },
    { key: 'order_date', label: 'Order Date', required: true, aliases: ['ordered on', 'date ordered', 'order date'] },
    { key: 'expected_delivery', label: 'Expected Delivery', required: false, aliases: ['expected', 'delivery date', 'eta'] },
    { key: 'status', label: 'Status', required: false, aliases: ['order status', 'state'] },
  ],
};

function parseCSVLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (c === ',' && !inQuotes) {
      out.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out.map(s => s.trim());
}

function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = parseCSVLine(lines[0]);
  const rows = lines.slice(1).map(line => {
    const cells = parseCSVLine(line);
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = cells[i] ?? ''; });
    return obj;
  });
  return { headers, rows };
}

function autoMap(headers: string[], type: ImportType): Record<string, string> {
  const fields = EXPECTED_FIELDS[type];
  const mapping: Record<string, string> = {};
  for (const field of fields) {
    const found = headers.find(h =>
      field.aliases.some(a => h.toLowerCase().trim() === a.toLowerCase().trim())
    );
    if (found) mapping[field.key] = found;
  }
  return mapping;
}

export function DataImportPage() {
  const [importType, setImportType] = useState<ImportType>('inventory');
  const [filename, setFilename] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [recent, setRecent] = useState<ImportLogRow[]>([]);
  const [recentLoading, setRecentLoading] = useState(true);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function loadRecent() {
    setRecentLoading(true);
    const { data } = await supabase
      .from('data_imports')
      .select('id, filename, import_type, row_count, valid_count, invalid_count, status, uploaded_by, created_at')
      .order('created_at', { ascending: false })
      .limit(20);
    setRecent((data ?? []) as ImportLogRow[]);
    setRecentLoading(false);
  }

  useEffect(() => { loadRecent(); }, []);

  function handleFile(file: File) {
    setResult(null);
    const isExcel = /\.xlsx?$/i.test(file.name);

    if (isExcel) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonRows = XLSX.utils.sheet_to_json<Record<string, any>>(firstSheet, { defval: '', raw: false });
        if (jsonRows.length === 0) {
          setResult({ ok: false, message: 'Excel file appears to be empty.' });
          return;
        }
        const headers = Object.keys(jsonRows[0]);
        const normalizedRows = jsonRows.map(r => {
          const obj: Record<string, string> = {};
          for (const h of headers) obj[h] = String(r[h] ?? '').trim();
          return obj;
        });
        setFilename(file.name);
        setHeaders(headers);
        setRows(normalizedRows);
        setMapping(autoMap(headers, importType));
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = String(e.target?.result ?? '');
        const { headers: h, rows: r } = parseCSV(text);
        setFilename(file.name);
        setHeaders(h);
        setRows(r);
        setMapping(autoMap(h, importType));
      };
      reader.readAsText(file);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  function clearFile() {
    setFilename('');
    setHeaders([]);
    setRows([]);
    setMapping({});
    setResult(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  const parsed: ParsedRow[] = rows.map((r, i) => {
    const fields = EXPECTED_FIELDS[importType];
    for (const field of fields) {
      if (!field.required) continue;
      const srcHeader = mapping[field.key];
      if (!srcHeader) {
        return { raw: r, isValid: false, message: `Missing mapping for "${field.label}"` };
      }
      const value = (r[srcHeader] ?? '').toString().trim();
      if (!value) {
        return { raw: r, isValid: false, message: `Row ${i + 2}: empty "${field.label}"` };
      }
      if (field.key.includes('quantity') && isNaN(Number(value))) {
        return { raw: r, isValid: false, message: `Row ${i + 2}: "${field.label}" is not a number` };
      }
    }
    return { raw: r, isValid: true };
  });

  const validCount = parsed.filter(p => p.isValid).length;
  const invalidCount = parsed.length - validCount;
  const canSubmit = filename && rows.length > 0 && Object.keys(mapping).length > 0 && !uploading;

  async function handleSubmit() {
    if (!canSubmit) return;
    setUploading(true);
    setResult(null);

    try {
      const { data: importRow, error: importError } = await supabase
        .from('data_imports')
        .insert({
          filename,
          import_type: importType,
          row_count: rows.length,
          valid_count: validCount,
          invalid_count: invalidCount,
          status: invalidCount === 0 ? 'completed' : 'partial',
          uploaded_by: 'demo-user',
          notes: `Column mapping: ${JSON.stringify(mapping)}`,
        })
        .select('id')
        .single();

      if (importError || !importRow) throw new Error(importError?.message ?? 'Failed to create import record');

      const importId = importRow.id;

      const rowsToInsert = parsed.map((p, idx) => ({
        import_id: importId,
        row_number: idx + 2,
        raw_data: p.raw,
        is_valid: p.isValid,
        validation_message: p.message ?? null,
      }));

      const CHUNK = 500;
      for (let i = 0; i < rowsToInsert.length; i += CHUNK) {
        const chunk = rowsToInsert.slice(i, i + CHUNK);
        const { error: rowErr } = await supabase.from('data_import_rows').insert(chunk);
        if (rowErr) throw new Error(rowErr.message);
      }

      setResult({
        ok: true,
        message: `Imported ${rows.length} rows (${validCount} valid, ${invalidCount} invalid). Staged under import ${importId.slice(0, 8)}.`,
      });
      clearFile();
      loadRecent();
    } catch (err) {
      setResult({
        ok: false,
        message: err instanceof Error ? err.message : 'Upload failed',
      });
    } finally {
      setUploading(false);
    }
  }

  function downloadTemplate() {
    const fields = EXPECTED_FIELDS[importType];

    // Sheet 1: Data with headers + example row
    const headerRow = fields.map(f => f.label);
    const exampleRow = fields.map(f => {
      if (f.key === 'facility_name') return 'Example District Hospital';
      if (f.key === 'medicine_name') return 'Amoxicillin 500mg';
      if (f.key === 'quantity' || f.key === 'quantity_ordered') return 500;
      if (f.key === 'period_start') return '2026-09-01';
      if (f.key === 'period_end') return '2026-09-30';
      if (f.key === 'order_date') return '2026-09-15';
      if (f.key === 'expected_delivery') return '2026-10-05';
      if (f.key === 'batch_number') return 'LOT-2026-001';
      if (f.key === 'expiry_date') return '2027-06-30';
      if (f.key === 'status') return 'pending';
      return '';
    });
    const dataSheet = XLSX.utils.aoa_to_sheet([headerRow, exampleRow]);
    dataSheet['!cols'] = headerRow.map(h => ({ wch: Math.max(h.length + 2, 20) }));

    // Sheet 2: Instructions
    const instructions = [
      ['Medisignal Africa — Data Import Template'],
      ['Import Type:', importType.charAt(0).toUpperCase() + importType.slice(1)],
      ['Generated:', new Date().toISOString().slice(0, 10)],
      [],
      ['Instructions:'],
      ['1. Do not rename the column headers in the "Data" sheet.'],
      ['2. Delete the example row before adding your own data.'],
      ['3. Required columns are marked below.'],
      ['4. Save as .xlsx or .csv and upload in the Data Import page.'],
      [],
      ['Column', 'Required', 'Description'],
      ...fields.map(f => [f.label, f.required ? 'Yes' : 'No', fieldDescription(f.key)]),
      [],
      ['Demo disclaimer: This is a synthetic demonstration environment.'],
    ];
    const instructionSheet = XLSX.utils.aoa_to_sheet(instructions);
    instructionSheet['!cols'] = [{ wch: 28 }, { wch: 12 }, { wch: 55 }];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, dataSheet, 'Data');
    XLSX.utils.book_append_sheet(workbook, instructionSheet, 'Instructions');

    XLSX.writeFile(workbook, `medisignal-${importType}-template.xlsx`);
  }

  function fieldDescription(key: string): string {
    switch (key) {
      case 'facility_name': return 'Exact name of the health facility as it appears in Medisignal';
      case 'medicine_name': return 'Exact name of the medicine (e.g. Amoxicillin 500mg)';
      case 'quantity': return 'Current stock count for inventory; consumed quantity for consumption';
      case 'quantity_ordered': return 'Number of units ordered in this purchase order';
      case 'batch_number': return 'Manufacturer lot/batch identifier (optional)';
      case 'expiry_date': return 'Expiry date in YYYY-MM-DD format (optional)';
      case 'period_start': return 'First day of the reporting period (YYYY-MM-DD)';
      case 'period_end': return 'Last day of the reporting period (YYYY-MM-DD)';
      case 'order_date': return 'Date the order was placed (YYYY-MM-DD)';
      case 'expected_delivery': return 'Expected delivery date (YYYY-MM-DD, optional)';
      case 'status': return 'Order status: pending, approved, in_transit, delivered, delayed, cancelled';
      default: return '';
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Data Import</h1>
          <p className="text-slate-500 text-sm mt-1">
            Upload stock, consumption, or procurement records from facilities, districts, or national LMIS exports.
          </p>
        </div>
        <button
          onClick={downloadTemplate}
          className="inline-flex items-center gap-2 bg-white border border-slate-300 text-slate-800 rounded-md px-3 py-1.5 text-sm font-medium hover:border-cyan-500 hover:text-cyan-600 transition"
        >
          <Download size={14} /> Download Template
        </button>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900">
        <strong>Data flow note:</strong> Uploaded rows are staged for review before merging into live inventory. Every upload is logged with timestamp, filename, and row counts so the source of any record is always traceable.
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-2">Import Type</label>
          <div className="flex gap-2">
            {(['inventory', 'consumption', 'procurement'] as ImportType[]).map(t => (
              <button
                key={t}
                onClick={() => {
                  setImportType(t);
                  if (headers.length > 0) setMapping(autoMap(headers, t));
                }}
                className={`px-3 py-1.5 text-sm rounded-md border transition ${
                  importType === t
                    ? 'bg-cyan-50 border-cyan-500 text-cyan-700 font-medium'
                    : 'bg-white border-slate-300 text-slate-700 hover:border-slate-400'
                }`}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {!filename ? (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className="border-2 border-dashed border-slate-300 rounded-lg p-10 text-center cursor-pointer hover:border-cyan-500 hover:bg-cyan-50/30 transition"
          >
            <Upload size={28} className="mx-auto text-slate-400 mb-3" />
            <div className="text-sm font-medium text-slate-700">Drop a CSV file here or click to browse</div>
            <div className="text-xs text-slate-500 mt-1">Accepts .xlsx or .csv up to 5,000 rows</div>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
          </div>
        ) : (
          <div className="border border-slate-200 rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-slate-700">
                <FileText size={16} className="text-cyan-500" />
                <span className="font-medium">{filename}</span>
                <span className="text-slate-400">·</span>
                <span className="text-slate-500">{rows.length} rows</span>
              </div>
              <button
                onClick={clearFile}
                className="text-slate-400 hover:text-slate-700 p-1"
                title="Remove file"
              >
                <X size={16} />
              </button>
            </div>

            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Column Mapping</div>
              <div className="space-y-2">
                {EXPECTED_FIELDS[importType].map(field => (
                  <div key={field.key} className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-center">
                    <label className="text-sm text-slate-700">
                      {field.label}
                      {field.required && <span className="text-red-500 ml-1">*</span>}
                    </label>
                    <select
                      value={mapping[field.key] ?? ''}
                      onChange={(e) => setMapping({ ...mapping, [field.key]: e.target.value })}
                      className="px-3 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-cyan-500"
                    >
                      <option value="">— not mapped —</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                Preview (first 5 rows)
              </div>
              <div className="overflow-x-auto border border-slate-200 rounded">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left px-2 py-1.5 text-slate-500 font-semibold w-8"></th>
                      {headers.map(h => <th key={h} className="text-left px-2 py-1.5 text-slate-500 font-semibold">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.slice(0, 5).map((p, i) => (
                      <tr key={i} className={`border-t border-slate-100 ${!p.isValid ? 'bg-red-50' : ''}`}>
                        <td className="px-2 py-1.5">
                          {p.isValid
                            ? <CheckCircle2 size={12} className="text-green-500" />
                            : <AlertCircle size={12} className="text-red-500" />
                          }
                        </td>
                        {headers.map(h => (
                          <td key={h} className="px-2 py-1.5 text-slate-700">{p.raw[h]}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {invalidCount > 0 && (
                <div className="text-[11px] text-red-600 mt-1">
                  {invalidCount} row(s) have validation errors. They will be staged but flagged.
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="text-xs text-slate-500">
                <span className="font-medium text-green-600">{validCount} valid</span>
                {invalidCount > 0 && <span className="ml-3 font-medium text-red-600">{invalidCount} invalid</span>}
              </div>
              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="inline-flex items-center gap-2 bg-cyan-500 hover:bg-cyan-600 disabled:bg-slate-300 text-white rounded-md px-4 py-2 text-sm font-medium transition"
              >
                <Upload size={14} />
                {uploading ? 'Uploading…' : 'Stage Upload'}
              </button>
            </div>
          </div>
        )}

        {result && (
          <div className={`text-sm p-3 rounded border ${
            result.ok ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            {result.message}
          </div>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-900 text-sm">Recent Uploads</h2>
          <p className="text-xs text-slate-500 mt-0.5">Every staged import is logged for traceability</p>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
            <tr>
              <th className="text-left px-4 py-3 font-semibold">Filename</th>
              <th className="text-left px-4 py-3 font-semibold">Type</th>
              <th className="text-right px-4 py-3 font-semibold">Rows</th>
              <th className="text-right px-4 py-3 font-semibold">Valid</th>
              <th className="text-right px-4 py-3 font-semibold">Invalid</th>
              <th className="text-left px-4 py-3 font-semibold">Status</th>
              <th className="text-left px-4 py-3 font-semibold">Uploaded</th>
            </tr>
          </thead>
          <tbody>
            {recent.map(r => (
              <tr key={r.id} className="border-t border-slate-100">
                <td className="px-4 py-2 font-medium text-slate-800">{r.filename}</td>
                <td className="px-4 py-2 text-slate-500 text-xs capitalize">{r.import_type}</td>
                <td className="px-4 py-2 text-right tabular-nums">{r.row_count}</td>
                <td className="px-4 py-2 text-right tabular-nums text-green-600">{r.valid_count}</td>
                <td className="px-4 py-2 text-right tabular-nums text-red-600">{r.invalid_count}</td>
                <td className="px-4 py-2">
                  <span className={`inline-block px-2 py-0.5 text-[10px] font-semibold border rounded uppercase ${
                    r.status === 'completed' ? 'bg-green-100 text-green-800 border-green-300'
                    : r.status === 'partial' ? 'bg-amber-100 text-amber-800 border-amber-300'
                    : r.status === 'failed' ? 'bg-red-100 text-red-800 border-red-300'
                    : 'bg-slate-100 text-slate-700 border-slate-300'
                  }`}>
                    {r.status}
                  </span>
                </td>
                <td className="px-4 py-2 text-slate-500 text-xs tabular-nums">
                  {new Date(r.created_at).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}
                </td>
              </tr>
            ))}
            {recent.length === 0 && !recentLoading && (
              <tr><td colSpan={7} className="text-center text-slate-400 py-8 text-sm">No uploads yet</td></tr>
            )}
            {recentLoading && (
              <tr><td colSpan={7} className="text-center text-slate-400 py-8 text-sm">Loading…</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}


