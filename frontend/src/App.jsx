import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { useOpenSky } from './hooks/useOpenSky';
import { FlightMarker } from './components/FlightMarker';
import { AirportLayer } from './components/AirportLayer';
import KochiTrafficPanel from './components/KochiTrafficPanel';
import { AnalyticsDashboard } from './components/analytics/AnalyticsDashboard.jsx';
import { useWeather } from './hooks/useWeather';
import { useKochiTraffic } from './hooks/useKochiTraffic';
import airportData from './data/airportData.json';

// Kochi (COK) airspace definition
const KOCHI_AIRSPACE = {
  lat: 10.1520,
  lng: 76.3930,
  radiusKm: 50,
};

const distanceKm = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const MAX_RENDERED_FLIGHTS = 300;
const BATCH_SIZE = 50;
const FRAME_INTERVAL = 1000 / 30;

const MapController = ({ selectedFlight, setBounds }) => {
  const map = useMap();
  useMapEvents({
    moveend: () => setBounds(map.getBounds()),
    zoomend: () => setBounds(map.getBounds())
  });
  useEffect(() => { setBounds(map.getBounds()); }, [map, setBounds]);
  useEffect(() => {
    if (selectedFlight) {
      map.flyTo([selectedFlight.latitude, selectedFlight.longitude], Math.max(map.getZoom(), 8), { animate: true, duration: 1.5 });
    }
  }, [selectedFlight, map]);
  return null;
};

function App() {
  const { flights, setBounds } = useOpenSky();
  const weather = useWeather();
  const kochiTraffic = useKochiTraffic();
  const [selectedFlight, setSelectedFlight] = useState(null);
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
  const aircraftRefs = useRef(new Map());
  const cursorGlowRef = useRef(null);

  // Mobile panel state
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isTrafficOpen, setIsTrafficOpen] = useState(false);
  const [activeAnalyticsTab, setActiveAnalyticsTab] = useState(null);

  // Detect mobile
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Close mobile panels when a flight is selected
  useEffect(() => {
    if (selectedFlight && isMobile) {
      setIsSidebarOpen(false);
      setIsTrafficOpen(false);
      setActiveAnalyticsTab(null);
    }
  }, [selectedFlight, isMobile]);

  // Mouse-following blue hue (desktop only)
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (cursorGlowRef.current) {
        cursorGlowRef.current.style.background =
          `radial-gradient(150px circle at ${e.clientX}px ${e.clientY}px, rgba(162,201,255,0.18), transparent 60%)`;
      }
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Progressive batch loading
  useEffect(() => {
    if (flights.length === 0) return;
    setVisibleCount(BATCH_SIZE);
    let batch = BATCH_SIZE;
    let rafId;
    const loadNextBatch = () => {
      batch += BATCH_SIZE;
      if (batch < Math.min(flights.length, MAX_RENDERED_FLIGHTS)) {
        setVisibleCount(batch);
        rafId = requestIdleCallback(loadNextBatch, { timeout: 100 });
      } else {
        setVisibleCount(Math.min(flights.length, MAX_RENDERED_FLIGHTS));
      }
    };
    if (typeof requestIdleCallback !== 'undefined') {
      rafId = requestIdleCallback(loadNextBatch, { timeout: 100 });
    } else {
      const timer = setTimeout(loadNextBatch, 50);
      return () => clearTimeout(timer);
    }
    return () => { if (typeof cancelIdleCallback !== 'undefined' && rafId) cancelIdleCallback(rafId); };
  }, [flights]);

  const renderedFlights = useMemo(() => flights.slice(0, visibleCount), [flights, visibleCount]);
  const handleFlightClick = useCallback((flight) => setSelectedFlight(flight), []);

  // Dead reckoning base positions
  useEffect(() => {
    const fetchTime = Date.now();
    flights.forEach(f => {
      let aircraft = aircraftRefs.current.get(f.icao24);
      if (!aircraft) {
        aircraft = { baseLat: f.latitude, baseLng: f.longitude, velocity: f.velocity || 0, heading: f.true_track || 0, markerRef: null, lastFetch: fetchTime };
        aircraftRefs.current.set(f.icao24, aircraft);
      } else {
        aircraft.baseLat = f.latitude;
        aircraft.baseLng = f.longitude;
        aircraft.velocity = f.velocity || 0;
        aircraft.heading = f.true_track || 0;
        aircraft.lastFetch = fetchTime;
      }
    });
    const currentIcaos = new Set(flights.map(f => f.icao24));
    for (const key of aircraftRefs.current.keys()) {
      if (!currentIcaos.has(key)) aircraftRefs.current.delete(key);
    }
  }, [flights]);

  // Global Animation Loop
  useEffect(() => {
    let reqId;
    let lastFrameTime = 0;
    const METERS_PER_DEG_LAT = 111320;
    const DEG_TO_RAD = Math.PI / 180;
    const animate = (timestamp) => {
      reqId = requestAnimationFrame(animate);
      if (timestamp - lastFrameTime < FRAME_INTERVAL) return;
      lastFrameTime = timestamp;
      const now = Date.now();
      for (const [, aircraft] of aircraftRefs.current.entries()) {
        if (!aircraft.markerRef) continue;
        const dt = Math.min((now - aircraft.lastFetch) / 1000, 30);
        if (aircraft.velocity < 1 || dt <= 0) continue;
        const headingRad = aircraft.heading * DEG_TO_RAD;
        const distMeters = aircraft.velocity * dt;
        const dLat = (distMeters * Math.cos(headingRad)) / METERS_PER_DEG_LAT;
        const dLng = (distMeters * Math.sin(headingRad)) / (METERS_PER_DEG_LAT * Math.cos(aircraft.baseLat * DEG_TO_RAD));
        aircraft.markerRef.setLatLng([aircraft.baseLat + dLat, aircraft.baseLng + dLng]);
      }
    };
    reqId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(reqId);
  }, []);

  const avgAltitude = flights.length > 0 ? Math.round(flights.reduce((sum, f) => sum + (f.altitude || 0), 0) / flights.length * 3.28084) : 0;
  const avgSpeed = flights.length > 0 ? Math.round(flights.reduce((sum, f) => sum + (f.velocity || 0), 0) / flights.length * 1.94384) : 0;

  // Panel visibility:
  // Traffic panel (right) — desktop: visible when no flight is selected (hides when flight detail shows)
  // Analytics panel (center-bottom) — visible only when an analytics tab is selected.
  // On mobile traffic is controlled by its FAB toggle.
  const trafficPanelVisible = isMobile ? isTrafficOpen : !selectedFlight;
  const analyticsPanelVisible = !!activeAnalyticsTab;

  return (
    <>
      <div className="fixed inset-0 z-0 bg-surface">
        <MapContainer
          center={[10.1520, 76.3930]}
          zoom={8}
          className="w-full h-full absolute inset-0 z-0 bg-surface outline-none"
          zoomControl={false}
          attributionControl={false}
          preferCanvas={true}
        >
          <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" attribution='&copy; <a href="https://carto.com/">CARTO</a>' />
          <MapController selectedFlight={selectedFlight} setBounds={setBounds} />
          <AirportLayer airports={airportData} />
          {renderedFlights.map((flight) => (
            <FlightMarker
              key={flight.icao24}
              flight={flight}
              aircraftRefs={aircraftRefs}
              isSelected={selectedFlight?.icao24 === flight.icao24}
              onClick={handleFlightClick}
            />
          ))}
        </MapContainer>

        {/* Dot grid overlay */}
        <div className="absolute inset-0 pointer-events-none z-10 opacity-[0.03]"
          style={{ backgroundImage: "radial-gradient(circle, rgba(162,201,255,0.8) 1px, transparent 1px)", backgroundSize: "60px 60px" }}
        />
        {/* Edge vignette */}
        <div className="absolute inset-0 pointer-events-none z-10" style={{ boxShadow: 'inset 0 0 150px 60px rgba(0,0,0,0.5)' }} />
        {/* Mouse-following blue hue (disabled on mobile touch screens) */}
        {!isMobile && <div ref={cursorGlowRef} className="absolute inset-0 pointer-events-none z-10" />}
      </div>

      {/* ── COK Traffic Panel ── */}
      <KochiTrafficPanel data={kochiTraffic} visible={trafficPanelVisible} isMobile={isMobile} />

      {/* ── Analytics Dashboard ── */}
      <AnalyticsDashboard visible={analyticsPanelVisible} isMobile={isMobile} activeTab={activeAnalyticsTab || 'overview'} />

      {/* ── Mobile sidebar backdrop ── */}
      {isMobile && isSidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* ── Header ── */}
      <header className="fixed top-0 left-0 right-0 z-50 flex justify-center items-center gap-3 sm:gap-4 px-4 sm:px-8 py-2.5 sm:py-3 rounded-full mt-3 mx-auto w-fit bg-white/[0.07] backdrop-blur-2xl border border-white/10 shadow-[0_10px_40px_rgba(0,0,0,0.4)] font-manrope">
        <div className="relative flex items-center gap-2">
          <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full border border-primary/40 flex items-center justify-center">
            <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-primary shadow-[0_0_8px_rgba(162,201,255,0.6)] animate-pulse" />
          </div>
          <span className="text-base sm:text-xl font-bold tracking-tighter text-white">SkyTrack</span>
        </div>
        <div className="h-4 w-px bg-white/10" />
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)] animate-pulse" />
          <span className="text-[9px] sm:text-[10px] uppercase tracking-widest text-emerald-400/80 font-medium">Live</span>
        </div>
      </header>

      {/* ── Sidebar ── */}
      <nav
        className={`fixed z-40 flex flex-col bg-white/[0.04] backdrop-blur-3xl rounded-2xl border border-white/[0.08] shadow-[0_20px_60px_rgba(0,0,0,0.5)] font-inter text-sm antialiased overflow-hidden transition-all duration-500 ease-out`}
        style={{
          // Unified sizing and placement
          width: '16rem',
          top: isMobile ? '4.5rem' : '50%',
          left: '1rem',
          transform: isMobile
            ? (isSidebarOpen ? 'translateX(0)' : 'translateX(calc(-100% - 1rem))')
            : 'translateX(0) translateY(-50%)',
          maxHeight: isMobile ? 'calc(100vh - 10rem)' : '85vh',
          opacity: isMobile ? (isSidebarOpen ? 1 : 0) : 1,
          pointerEvents: isMobile ? (isSidebarOpen ? 'auto' : 'none') : 'none',
        }}
      >
        {/* Mobile close button */}
        {isMobile && (
          <button
            className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-white/10 border border-white/20 text-white/70 hover:text-white pointer-events-auto cursor-pointer"
            onClick={() => setIsSidebarOpen(false)}
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        )}

        {/* Sidebar header */}
        <div className="p-5 pb-4 pointer-events-auto border-b border-white/5 flex-shrink-0">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-primary text-base" style={{ fontVariationSettings: "'FILL' 1" }}>radar</span>
            </div>
            <div>
              <div className="text-sky-300 font-headline font-bold text-sm tracking-tight">Air Traffic</div>
              <div className="text-slate-500 text-[9px] uppercase tracking-[0.2em]">Control Panel</div>
            </div>
          </div>
        </div>

        {/* Live Weather — COK Airspace */}
        <div className="p-4 pointer-events-auto border-b border-white/5 flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[9px] text-slate-500 uppercase tracking-[0.2em]">COK Weather</div>
            {weather && (
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-primary text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>{weather.icon}</span>
                <span className="text-[10px] text-on-surface/70 font-medium">{weather.condition}</span>
              </div>
            )}
          </div>
          {weather ? (
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-white/[0.03] rounded-xl p-3 border border-white/5 text-center">
                <div className="text-[9px] text-slate-500 uppercase tracking-widest mb-1">Temp</div>
                <div className="text-lg font-headline font-bold text-on-surface leading-none">{weather.temp}°<span className="text-[10px] font-normal opacity-40">C</span></div>
                <div className="text-[9px] text-slate-500 mt-0.5">feels {weather.feelsLike}°</div>
              </div>
              <div className="bg-white/[0.03] rounded-xl p-3 border border-white/5 text-center">
                <div className="text-[9px] text-slate-500 uppercase tracking-widest mb-1">Humidity</div>
                <div className="text-lg font-headline font-bold text-on-surface leading-none">{weather.humidity}<span className="text-[10px] font-normal opacity-40">%</span></div>
                <div className="text-[9px] text-slate-500 mt-0.5">relative</div>
              </div>
              <div className="bg-white/[0.03] rounded-xl p-3 border border-white/5 text-center">
                <div className="text-[9px] text-slate-500 uppercase tracking-widest mb-1">Wind</div>
                <div className="text-sm font-headline font-bold text-on-surface leading-none">{weather.windSpeed} <span className="text-[10px] font-normal opacity-40">kts</span></div>
                <div className="text-[9px] text-slate-500 mt-0.5">{weather.windDir}° dir</div>
              </div>
              <div className="bg-white/[0.03] rounded-xl p-3 border border-white/5 text-center">
                <div className="text-[9px] text-slate-500 uppercase tracking-widest mb-1">Visibility</div>
                <div className="text-sm font-headline font-bold text-on-surface leading-none">{weather.visibility} <span className="text-[10px] font-normal opacity-40">km</span></div>
                <div className="text-[9px] text-slate-500 mt-0.5">range</div>
              </div>
            </div>
          ) : (
            <div className="text-[10px] text-slate-500 text-center py-4">Loading weather...</div>
          )}
        </div>

        {/* COK Airspace indicator */}
        <div className="p-4 pointer-events-auto border-b border-white/5 flex-shrink-0">
          <div className="flex items-center gap-3 bg-primary/[0.06] rounded-xl p-3 border border-primary/10">
            <div className="relative flex-shrink-0">
              <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center">
                <span className="material-symbols-outlined text-primary text-sm">cell_tower</span>
              </div>
              <div className="absolute inset-0 rounded-full border border-primary/20 animate-pulse-ring" />
            </div>
            <div>
              <div className="text-[10px] font-headline font-bold text-primary-fixed-dim">COK Airspace</div>
              <div className="text-[9px] text-slate-500 uppercase tracking-wider">50 km zone • Monitoring</div>
            </div>
          </div>
        </div>

        {/* Nearby flights — scrollable */}
        <div className="p-4 pointer-events-auto flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="text-[9px] text-slate-500 uppercase tracking-[0.2em] mb-3 flex-shrink-0">Nearby Flights</div>
          <div className="space-y-1 overflow-y-auto scrollbar-hide flex-1 min-h-0">
            {flights.slice(0, 8).map(f => (
              <div
                key={f.icao24}
                className={`flex justify-between items-center cursor-pointer p-2 rounded-lg transition-all duration-200 ${selectedFlight?.icao24 === f.icao24
                  ? 'bg-primary/10 border border-primary/20'
                  : 'hover:bg-white/5 border border-transparent'}`}
                onClick={() => { setSelectedFlight(f); if (isMobile) setIsSidebarOpen(false); }}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${selectedFlight?.icao24 === f.icao24 ? 'bg-primary shadow-[0_0_4px_rgba(162,201,255,0.5)]' : 'bg-slate-600'}`} />
                  <span className={`text-xs font-mono ${selectedFlight?.icao24 === f.icao24 ? 'text-primary-fixed-dim' : 'text-on-surface opacity-70'}`}>
                    {f.callsign || f.icao24} {f.type || ''}
                  </span>
                </div>
                <span className="text-[10px] text-slate-500 font-mono">{Math.round(f.altitude * 3.28084)} ft</span>
              </div>
            ))}
          </div>
        </div>
      </nav>

      {/* ── Flight detail panel ── */}
      <main className={`fixed z-40 font-inter transition-all duration-500 ${isMobile
          ? 'bottom-20 left-3 right-3'
          : 'bottom-14 right-6 w-80'
        } ${selectedFlight ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'}`}>
        <div className="bg-white/[0.04] backdrop-blur-3xl rounded-2xl border border-white/[0.08] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.5)] flex flex-col pointer-events-auto relative overflow-hidden">
          {/* Accent line */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-2xl font-headline font-extrabold text-primary-fixed-dim leading-none">{selectedFlight?.callsign || 'UNKNOWN'} - {selectedFlight?.type || ''}</h2>
              <p className="text-[10px] text-on-surface-variant uppercase tracking-widest mt-1">{selectedFlight?.country || 'NA'}</p>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 text-emerald-400 text-[10px] font-bold rounded-full border border-emerald-500/20 uppercase">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Airborne
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="p-3 bg-white/[0.03] rounded-xl border border-white/5 text-center">
              <p className="text-[9px] text-on-surface-variant uppercase tracking-wider mb-1">Altitude</p>
              <p className="text-lg font-headline font-bold text-on-surface leading-none">{Math.round((selectedFlight?.altitude || 0) * 3.28084)}<span className="text-[10px] ml-1 font-normal opacity-40">ft</span></p>
            </div>
            <div className="p-3 bg-white/[0.03] rounded-xl border border-white/5 text-center">
              <p className="text-[9px] text-on-surface-variant uppercase tracking-wider mb-1">Speed</p>
              <p className="text-lg font-headline font-bold text-on-surface leading-none">{Math.round((selectedFlight?.velocity || 0) * 1.94384)}<span className="text-[10px] ml-1 font-normal opacity-40">kts</span></p>
            </div>
            <div className="p-3 bg-white/[0.03] rounded-xl border border-white/5 text-center">
              <p className="text-[9px] text-on-surface-variant uppercase tracking-wider mb-1">Heading</p>
              <p className="text-lg font-headline font-bold text-on-surface leading-none">{Math.round(selectedFlight?.true_track || 0)}°</p>
            </div>
            <div className="p-3 bg-white/[0.03] rounded-xl border border-white/5 text-center">
              <p className="text-[9px] text-on-surface-variant uppercase tracking-wider mb-1">Squawk</p>
              <p className="text-lg font-headline font-bold text-on-surface leading-none">{selectedFlight?.squawk || 'N/A'}</p>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-white/5">
            <div className="flex items-center gap-2 mb-3">
              <span className="material-symbols-outlined text-sm text-primary/60">location_on</span>
              <span className="text-[11px] font-mono text-on-surface-variant">{selectedFlight?.latitude?.toFixed(4)}° N, {selectedFlight?.longitude?.toFixed(4)}° E</span>
            </div>
            <button
              className="w-full py-2.5 bg-gradient-to-r from-primary/80 to-primary-container/60 text-on-primary text-[11px] font-headline font-bold uppercase tracking-wider rounded-xl transition-all duration-200 active:scale-[0.98] hover:shadow-lg hover:shadow-primary/20 cursor-pointer border-none flex items-center justify-center gap-1.5"
              onClick={() => setSelectedFlight(null)}
            >
              <span className="material-symbols-outlined text-sm">close</span>
              Deselect Flight
            </button>
          </div>
        </div>
      </main>

      {/* ── Mobile FABs (floating action buttons) ── */}
      {isMobile && (
        <div className="fixed bottom-16 left-0 right-0 z-50 flex justify-between px-4 pointer-events-none">
          {/* Sidebar toggle */}
          <button
            className="pointer-events-auto w-12 h-12 rounded-2xl bg-white/[0.08] backdrop-blur-2xl border border-white/15 shadow-[0_8px_24px_rgba(0,0,0,0.5)] flex items-center justify-center text-on-surface/80 hover:text-white active:scale-95 transition-all duration-200 cursor-pointer"
            onClick={() => { setIsSidebarOpen(v => !v); setIsTrafficOpen(false); setIsAnalyticsOpen(false); }}
          >
            <span className="material-symbols-outlined text-xl">radar</span>
          </button>

          {/* Traffic panel toggle */}
          <button
            className="pointer-events-auto w-12 h-12 rounded-2xl bg-white/[0.08] backdrop-blur-2xl border border-white/15 shadow-[0_8px_24px_rgba(0,0,0,0.5)] flex items-center justify-center text-on-surface/80 hover:text-white active:scale-95 transition-all duration-200 cursor-pointer"
            onClick={() => { setIsTrafficOpen(v => !v); setIsSidebarOpen(false); setActiveAnalyticsTab(null); }}
          >
            <span className="material-symbols-outlined text-xl">connecting_airports</span>
          </button>
        </div>
      )}

      {/* ── Bottom Center Analytics Navbar ── */}
      <nav className="fixed bottom-12 sm:bottom-14 left-1/2 transform -translate-x-1/2 z-50 flex items-center gap-2 p-1.5 bg-white/[0.04] backdrop-blur-3xl rounded-2xl border border-white/[0.08] shadow-[0_20px_60px_rgba(0,0,0,0.5)] pointer-events-auto transition-all duration-300">
        {[
          { id: 'overview', icon: 'dashboard', label: 'Overview' },
          { id: 'fleet', icon: 'flight', label: 'Fleet' },
          { id: 'recent', icon: 'history', label: 'Recent' }
        ].map(tab => {
          const isActive = activeAnalyticsTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveAnalyticsTab(isActive ? null : tab.id);
                setIsSidebarOpen(false);
                setIsTrafficOpen(false);
                setSelectedFlight(null); // Close flight details if opening analytics
              }}
              className={`flex items-center gap-2 px-4 py-2 sm:py-2.5 rounded-xl transition-all duration-200 cursor-pointer ${isActive ? 'bg-primary/20 text-primary border border-primary/30 shadow-inner' : 'bg-transparent text-on-surface/70 hover:bg-white/5 border border-transparent hover:text-white'}`}
            >
              <span className="material-symbols-outlined text-[16px] sm:text-[18px]" style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}>{tab.icon}</span>
              <span className="text-[10px] sm:text-[11px] font-headline font-bold uppercase tracking-widest">{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* ── Footer ── */}
      <footer className="fixed bottom-0 w-full z-50 flex justify-between items-center px-4 sm:px-8 py-2 sm:py-2.5 bg-white/[0.03] backdrop-blur-xl border-t border-white/5 font-inter text-[9px] sm:text-[10px] tracking-widest uppercase pointer-events-none">
        <div className="flex items-center gap-3 sm:gap-4 pointer-events-auto">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)] animate-pulse" />
            <span className="text-emerald-400/80">Online</span>
          </div>
          <div className="h-3 w-px bg-white/10" />
          <span className="text-slate-500">
            <span className="text-on-surface font-medium">{flights.length}</span> flights
            {visibleCount < flights.length && <span className="text-slate-600"> • {visibleCount} shown</span>}
          </span>
        </div>
        <div className="flex items-center gap-3 sm:gap-4 pointer-events-auto">
          <span className="text-slate-600 hidden sm:block">{new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })}</span>
          <div className="h-3 w-px bg-white/10 hidden sm:block" />
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_5px_#a2c9ff] animate-pulse" />
            <span className="text-on-surface/70">Data Sync</span>
          </div>
        </div>
      </footer>
    </>
  );
}

export default App;
