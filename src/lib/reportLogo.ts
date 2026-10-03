/**
 * Inline SVG logo for embedding in standalone HTML reports.
 * Cyan gradient square with a signal/pulse line and peak dot.
 */
export const REPORT_LOGO_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="48" height="48" fill="none" style="display:block;">
  <defs>
    <linearGradient id="medisignalLogoBg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#22d3ee"/>
      <stop offset="100%" stop-color="#2563eb"/>
    </linearGradient>
  </defs>
  <rect x="2" y="2" width="60" height="60" rx="14" fill="url(#medisignalLogoBg)"/>
  <path d="M 10 32 L 20 32 L 26 20 L 34 44 L 40 32 L 54 32"
        stroke="#ffffff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  <circle cx="26" cy="20" r="3.5" fill="#ffffff"/>
  <rect x="2" y="2" width="60" height="60" rx="14" fill="none" stroke="#ffffff" stroke-opacity="0.2" stroke-width="1"/>
</svg>
`.trim();

/**
 * Small horizontal lockup: logo + wordmark, for use in report headers.
 */
export const REPORT_HEADER_LOCKUP = `
<div style="display:flex;align-items:center;gap:12px;">
  <div style="width:44px;height:44px;flex-shrink:0;">${REPORT_LOGO_SVG}</div>
  <div style="line-height:1.15;">
    <div style="font-size:15px;font-weight:700;color:#0f172a;font-family:Helvetica,Arial,sans-serif;">Medisignal</div>
    <div style="font-size:9px;letter-spacing:0.18em;text-transform:uppercase;color:#64748b;font-family:Helvetica,Arial,sans-serif;font-weight:600;">Africa</div>
  </div>
</div>
`.trim();
