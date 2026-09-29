import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import { Maximize2, Minimize2 } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { ShortageRadarRow, Facility } from '../types';

const RISK_COLORS: Record<string, string> = {
  Critical: '#ff2d55',
  High: '#ff9500',
  Medium: '#ffd60a',
  Low: '#00ff9f',
  'Insufficient Data': '#94a3b8',
};

const COUNTRY_CENTERS: Record<string, { center: [number, number]; zoom: number }> = {
  Botswana: { center: [-22.3, 24.7], zoom: 6 },
  Kenya: { center: [0.0, 37.9], zoom: 6 },
  default: { center: [2.0, 20.0], zoom: 4 },
};

function getRiskColor(risk: string) {
  return RISK_COLORS[risk] ?? RISK_COLORS['Insufficient Data'];
}

function getWorstRisk(rows: ShortageRadarRow[]): string {
  const rank: Record<string, number> = { Critical: 4, High: 3, Medium: 2, Low: 1 };
  let worst = 'Low';
  for (const r of rows) {
    if ((rank[r.risk_level] ?? 0) > (rank[worst] ?? 0)) worst = r.risk_level;
  }
  return worst;
}

function RecenterMap({ country }: { country: string | null }) {
  const map = useMap();
  useEffect(() => {
    const target = COUNTRY_CENTERS[country ?? 'default'] ?? COUNTRY_CENTERS.default;
    map.setView(target.center, target.zoom);
  }, [country, map]);
  return null;
}

interface MapPanelProps {
  radarData: ShortageRadarRow[];
  facilities: Facility[];
  country: string | null;
  loading?: boolean;
}

export function MapPanel({ radarData, facilities, country, loading }: MapPanelProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const worstRiskByFacility = new Map<string, string>();
  for (const f of facilities) {
    const rows = radarData.filter((r) => r.facility_id === f.id);
    worstRiskByFacility.set(f.id, rows.length ? getWorstRisk(rows) : 'Low');
  }

  const toggleFullscreen = async () => {
    if (!wrapperRef.current) return;
    if (!document.fullscreenElement) {
      await wrapperRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    const timer = setTimeout(() => mapRef.current?.invalidateSize(), 200);
    return () => clearTimeout(timer);
  }, [isFullscreen]);

  useEffect(() => {
    document.body.style.overflow = isFullscreen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isFullscreen]);

  const initial = COUNTRY_CENTERS[country ?? 'default'] ?? COUNTRY_CENTERS.default;

  return (
    <div ref={wrapperRef} className="map-wrapper relative bg-slate-950 rounded-lg border border-cyan-500/30 shadow-[0_0_40px_rgba(6,182,212,0.15)] overflow-hidden">
      <div className="px-4 py-3 border-b border-cyan-500/20 bg-slate-950 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
            National Shortage Map
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {country ? `${country} · ` : 'All Africa · '}Live Risk Telemetry · Demonstration Data
          </p>
        </div>
      </div>

      <div className="relative" style={{ height: isFullscreen ? 'calc(100vh - 60px)' : 520 }}>
        <button
          onClick={toggleFullscreen}
          className="absolute top-3 right-3 z-[1000] bg-slate-950/90 backdrop-blur border border-cyan-500/40 rounded-md p-2 hover:border-cyan-400 hover:bg-cyan-500/10 transition"
          title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        >
          {isFullscreen
            ? <Minimize2 size={16} className="text-cyan-400" />
            : <Maximize2 size={16} className="text-cyan-400" />}
        </button>

        <div
          className="absolute inset-0 pointer-events-none z-[400]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(0, 200, 255, 0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 200, 255, 0.08) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />

        <MapContainer
          ref={mapRef}
          center={initial.center}
          zoom={initial.zoom}
          style={{ height: '100%', width: '100%', background: '#050b18' }}
          zoomControl={true}
          attributionControl={true}
        >
          <TileLayer
            url="https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://stadiamaps.com/">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />
          <RecenterMap country={country} />

          {facilities.map((f) => {
            if (f.latitude == null || f.longitude == null) return null;
            const worst = worstRiskByFacility.get(f.id) ?? 'Low';
            const color = getRiskColor(worst);
            const pos: [number, number] = [f.latitude, f.longitude];
            const rows = radarData.filter((r) => r.facility_id === f.id);
            const criticalCount = rows.filter((r) => r.risk_level === 'Critical').length;
            const highCount = rows.filter((r) => r.risk_level === 'High').length;

            return (
              <div key={f.id}>
                <CircleMarker
                  center={pos}
                  radius={14}
                  pathOptions={{ color, weight: 1, opacity: 0.6, fill: false }}
                />
                {(worst === 'Critical' || worst === 'High') && (
                  <CircleMarker
                    center={pos}
                    radius={10}
                    pathOptions={{ color: 'transparent', fillColor: color, fillOpacity: 0.25, stroke: false }}
                  />
                )}
                <CircleMarker
                  center={pos}
                  radius={5}
                  className={worst === 'Critical' ? 'marker-critical' : ''}
                  pathOptions={{ color: '#e0f2fe', weight: 1.5, fillColor: color, fillOpacity: 1 }}
                >
                  <Popup>
                    <div className="text-xs">
                      <div className="font-semibold text-slate-900">{f.name}</div>
                      <div className="text-slate-500">{f.district} · {f.facility_type}</div>
                      <div className="mt-2 pt-2 border-t border-slate-200">
                        <div>Worst risk: <span className="font-semibold" style={{ color }}>{worst}</span></div>
                        <div>Critical medicines: {criticalCount}</div>
                        <div>High medicines: {highCount}</div>
                      </div>
                    </div>
                  </Popup>
                </CircleMarker>
              </div>
            );
          })}
        </MapContainer>

        <div className="absolute bottom-3 right-3 z-[1000] bg-slate-950/95 backdrop-blur rounded-lg border border-cyan-500/40 p-3 text-xs">
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-400 mb-2">Threat Level</div>
          {[
            { label: 'Critical', color: '#ff2d55' },
            { label: 'High', color: '#ff9500' },
            { label: 'Medium', color: '#ffd60a' },
            { label: 'OK', color: '#00ff9f' },
          ].map((x) => (
            <div key={x.label} className="flex items-center gap-2 py-0.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: x.color, boxShadow: `0 0 6px ${x.color}` }} />
              <span className="text-slate-300">{x.label}</span>
            </div>
          ))}
        </div>

        <style>{`
          .leaflet-container { background: #050b18 !important; }
          .leaflet-tile-pane { filter: hue-rotate(180deg) saturate(1.4) brightness(0.7) contrast(1.2); }
          .marker-critical {
            animation: pulse-critical 1.6s ease-in-out infinite;
          }
          @keyframes pulse-critical {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.55; }
          }
        `}</style>
      </div>
    </div>
  );
}
