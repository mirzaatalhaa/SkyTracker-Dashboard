import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { MapContainer, TileLayer, useMap, useMapEvents, Circle } from 'react-leaflet';
import { useOpenSky } from './hooks/useOpenSky';
import { FlightMarker } from './components/FlightMarker';
import { AirportLayer } from './components/AirportLayer';
import KochiTrafficPanel from './components/KochiTrafficPanel';
import { AnalyticsDashboard } from './components/analytics/AnalyticsDashboard.jsx';
import { useWeather } from './hooks/useWeather';
import { useKochiTraffic } from './hooks/useKochiTraffic';
import airportData from './data/airportData.json';
import { SmoothCursor } from './components/ui/SmoothCursor';

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

const getAirlineFromCallsign = (callsign) => {
  if (!callsign) return null;
  const cleanCallsign = callsign.trim().toUpperCase();
  
  const airlineMap = {
    'AIC': 'Air India',
    'AXB': 'Air India Express',
    'IAD': 'Air India Express',
    'IGO': 'IndiGo',
    'AKJ': 'Akasa Air',
    'SEJ': 'SpiceJet',
    'LLR': 'Alliance Air',
    'GOY': 'Fly91',
    'UAE': 'Emirates',
    'ETD': 'Etihad Airways',
    'QTR': 'Qatar Airways',
    'FDB': 'Flydubai',
    'ABY': 'Air Arabia',
    'ADY': 'Air Arabia Abu Dhabi',
    'OMA': 'Oman Air',
    'GFA': 'Gulf Air',
    'KAC': 'Kuwait Airways',
    'SVA': 'Saudia',
    'OMS': 'SalamAir',
    'JZR': 'Jazeera Airways',
    'SIA': 'Singapore Airlines',
    'TGW': 'Scoot',
    'THA': 'Thai Airways',
    'AIQ': 'Thai AirAsia',
    'TLM': 'Thai Lion Air',
    'MXD': 'Batik Air Malaysia',
    'MAS': 'Malaysia Airlines',
    'VJC': 'VietJet Air',
    'ALK': 'SriLankan Airlines',
    'AXM': 'AirAsia',
    'VIR': 'Virgin Atlantic',
    'DLH': 'Lufthansa',
    'KLM': 'KLM',
  };

  for (const [prefix, name] of Object.entries(airlineMap)) {
    if (cleanCallsign.startsWith(prefix)) {
      return name;
    }
  }
  return null;
};

const ToastItem = ({ alert, onDismiss, onLocate }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(alert.id);
    }, 6000);
    return () => clearTimeout(timer);
  }, [alert.id, onDismiss]);

  const altFeet = Math.round((alert.altitude || 0) * 3.28084);
  const speedKnots = Math.round((alert.speed || 0) * 1.94384);

  return (
    <div 
      className="w-72 bg-white/[0.04] backdrop-blur-3xl rounded-xl border border-white/[0.08] shadow-[0_12px_40px_rgba(0,0,0,0.5)] relative overflow-hidden flex flex-col animate-slide-in pointer-events-auto"
      style={{ zIndex: 60 }}
    >
      {/* Top accent line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-400/60 to-transparent" />
      
      {/* Alert Header */}
      <div className="px-4 pt-3.5 pb-2 flex justify-between items-start">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-amber-400 text-base animate-pulse" style={{ fontVariationSettings: "'FILL' 1" }}>
            warning
          </span>
          <div className="min-w-0">
            <div className="text-xs font-bold text-amber-300 uppercase tracking-wider">Airspace Entry</div>
          </div>
        </div>
        <button 
          onClick={() => onDismiss(alert.id)}
          className="text-white/40 hover:text-white transition-colors cursor-pointer border-none bg-transparent flex"
        >
          <span className="material-symbols-outlined text-[16px]">close</span>
        </button>
      </div>

      {/* Flight info */}
      <div className="px-4 pb-2.5">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-mono font-extrabold text-white">{alert.callsign}</span>
          <span className="text-[10px] text-white/50 truncate max-w-[120px]">{alert.type}</span>
        </div>
        <div className="text-[10px] text-white/40 mt-0.5">
          Within 50km of COK • {Math.round(alert.distance).toFixed(1)} km out
        </div>
      </div>

      {/* Quick stats & action */}
      <div className="px-4 pb-3 pt-2.5 border-t border-white/5 flex items-center justify-between">
        <div className="flex gap-4">
          <div>
            <div className="text-[7px] font-bold text-white/30 uppercase tracking-widest">ALT</div>
            <div className="text-[11px] font-bold text-white leading-none mt-0.5">
              {altFeet.toLocaleString()}<span className="text-[8px] font-normal opacity-40 ml-0.5">ft</span>
            </div>
          </div>
          <div>
            <div className="text-[7px] font-bold text-white/30 uppercase tracking-widest">SPD</div>
            <div className="text-[11px] font-bold text-white leading-none mt-0.5">
              {speedKnots}<span className="text-[8px] font-normal opacity-40 ml-0.5">kts</span>
            </div>
          </div>
        </div>

        <button 
          onClick={() => onLocate(alert.flight)}
          className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-400/10 hover:bg-amber-400/20 text-amber-300 text-[9px] font-bold uppercase tracking-wider rounded-lg transition-colors border border-amber-400/20 cursor-pointer"
        >
          <span className="material-symbols-outlined text-[10px]">my_location</span>
          Locate
        </button>
      </div>
    </div>
  );
};

function App() {
  const { flights, setBounds } = useOpenSky();
  const weather = useWeather();
  const kochiTraffic = useKochiTraffic();
  const [selectedFlight, setSelectedFlight] = useState(null);
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
  const aircraftRefs = useRef(new Map());

  // Mobile panel state
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isTrafficOpen, setIsTrafficOpen] = useState(false);
  const [activeAnalyticsTab, setActiveAnalyticsTab] = useState(null);

  // Airspace entry alert state
  const [alerts, setAlerts] = useState([]);
  const [alertHistory, setAlertHistory] = useState([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Airspace tracking refs
  const flightsInAirspaceRef = useRef(new Set());
  const flightsLastSeenInAirspaceRef = useRef(new Map());
  const isFirstLoadRef = useRef(true);

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

  // Close every panel at once (used by backdrop tap)
  const handleCloseAllPanels = useCallback(() => {
    setIsSidebarOpen(false);
    setIsTrafficOpen(false);
    setIsHistoryOpen(false);
    setActiveAnalyticsTab(null);
  }, []);

  // Toggle one panel — opening it closes all others (single-panel-at-a-time)
  const handlePanelToggle = useCallback((panel) => {
    const isOpen =
      panel === 'sidebar'  ? isSidebarOpen  :
      panel === 'traffic'  ? isTrafficOpen  :
      panel === 'history'  ? isHistoryOpen  :
      activeAnalyticsTab === panel;
    setIsSidebarOpen(false);
    setIsTrafficOpen(false);
    setIsHistoryOpen(false);
    setActiveAnalyticsTab(null);
    if (!isOpen) {
      if      (panel === 'sidebar')  setIsSidebarOpen(true);
      else if (panel === 'traffic')  setIsTrafficOpen(true);
      else if (panel === 'history')  setIsHistoryOpen(true);
      else                           setActiveAnalyticsTab(panel);
    }
  }, [isSidebarOpen, isTrafficOpen, isHistoryOpen, activeAnalyticsTab]);

  const handleToggleHistory = useCallback(() => {
    setIsHistoryOpen(prev => {
      const next = !prev;
      if (next) {
        setAlerts([]); // Clear active toasts when opening history
        setUnreadCount(0); // Reset badge
        setIsSidebarOpen(false);
        setIsTrafficOpen(false);
        setActiveAnalyticsTab(null);
      }
      return next;
    });
  }, []);

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

  // Airspace Entry Tracking Effect
  useEffect(() => {
    if (flights.length === 0) return;

    const now = Date.now();

    // 1. Process current flights to see which ones are inside COK airspace
    flights.forEach(f => {
      const dist = distanceKm(f.latitude, f.longitude, KOCHI_AIRSPACE.lat, KOCHI_AIRSPACE.lng);
      const isInside = dist <= KOCHI_AIRSPACE.radiusKm;

      if (isInside) {
        // Record last seen time
        flightsLastSeenInAirspaceRef.current.set(f.icao24, now);

        if (!flightsInAirspaceRef.current.has(f.icao24)) {
          // It entered!
          flightsInAirspaceRef.current.add(f.icao24);

          // If it's the very first data load, we initialize the set but don't fire alerts
          // to avoid spamming the user on page load.
          if (!isFirstLoadRef.current) {
            const newAlert = {
              id: `${f.icao24}-${now}`,
              icao24: f.icao24,
              callsign: f.callsign || 'UNKNOWN',
              type: f.type || 'Unknown Aircraft',
              altitude: f.altitude,
              speed: f.velocity,
              distance: dist,
              timestamp: new Date(),
              flight: f, // Store flight reference to easily "Locate"
            };

            // Add to active toast alerts
            setAlerts(prev => [newAlert, ...prev]);

            // Add to history log
            setAlertHistory(prev => [newAlert, ...prev]);
            
            // Increment unread badge count
            setUnreadCount(prev => prev + 1);
          }
        }
      }
    });

    // 2. Clean up flights in the airspace tracker
    // Remove if they physically moved out (distance > 50km) or haven't been seen for 45s
    for (const icao of flightsInAirspaceRef.current) {
      const flightInCurrentFeed = flights.find(f => f.icao24 === icao);
      
      if (flightInCurrentFeed) {
        const dist = distanceKm(flightInCurrentFeed.latitude, flightInCurrentFeed.longitude, KOCHI_AIRSPACE.lat, KOCHI_AIRSPACE.lng);
        if (dist > KOCHI_AIRSPACE.radiusKm) {
          // Physically moved out
          flightsInAirspaceRef.current.delete(icao);
          flightsLastSeenInAirspaceRef.current.delete(icao);
        }
      } else {
        // Not in current feed, check timeout
        const lastSeen = flightsLastSeenInAirspaceRef.current.get(icao);
        if (!lastSeen || (now - lastSeen > 45000)) {
          flightsInAirspaceRef.current.delete(icao);
          flightsLastSeenInAirspaceRef.current.delete(icao);
        }
      }
    }

    if (isFirstLoadRef.current) {
      isFirstLoadRef.current = false;
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
          {/* Subtle dashed amber circle representing the 50km airspace boundary */}
          <Circle
            center={[10.1520, 76.3930]}
            radius={50000} // 50 km in meters
            pathOptions={{
              color: 'rgba(245, 158, 11, 0.4)',
              fillColor: 'rgba(245, 158, 11, 0.02)',
              fillOpacity: 0.02,
              weight: 1.5,
              dashArray: '5, 8',
            }}
          />
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
      </div>

      {/* ── COK Traffic Panel ── */}
      <KochiTrafficPanel data={kochiTraffic} visible={trafficPanelVisible} isMobile={isMobile} />

      {/* ── Analytics Dashboard ── */}
      <AnalyticsDashboard visible={analyticsPanelVisible} isMobile={isMobile} activeTab={activeAnalyticsTab || 'overview'} />

      {/* ── Unified backdrop — closes ANY open panel when tapping outside ── */}
      {(analyticsPanelVisible || (isMobile && (isSidebarOpen || isTrafficOpen || isHistoryOpen))) && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-[1px]"
          style={{ zIndex: 35 }}
          onClick={handleCloseAllPanels}
        />
      )}

      {/* ── Header ── */}
      <header className="fixed top-5 left-0 right-0 z-50 flex justify-center items-center gap-3 mx-auto w-fit font-manrope select-none">
        <div className="logo-icon-wrap">
          <span
            className="material-symbols-outlined text-2xl sm:text-3xl text-primary drop-shadow-[0_0_8px_rgba(162,201,255,0.4)]"
            style={{ fontVariationSettings: "'FILL' 1", transform: 'rotate(-45deg)' }}
          >flight</span>
        </div>
        <span className="logo-text-gradient text-2xl sm:text-3xl font-extrabold tracking-tight">SkyTrack</span>
      </header>

      {/* ── Airspace Alerts Bell & History Dropdown ── */}
      <div className="fixed top-4 right-4 z-50 font-inter">
        <button
          onClick={handleToggleHistory}
          className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all duration-300 cursor-pointer ${
            isHistoryOpen
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/30 shadow-inner'
              : 'bg-white/[0.04] backdrop-blur-3xl text-white/70 border-white/[0.08] hover:bg-white/10 hover:text-white shadow-lg'
          }`}
        >
          <div className="relative">
            <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: isHistoryOpen ? "'FILL' 1" : "'FILL' 0" }}>
              notifications
            </span>
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-amber-500 text-black text-[9px] font-extrabold flex items-center justify-center shadow-[0_0_8px_rgba(245,158,11,0.5)] animate-pulse">
                {unreadCount}
              </span>
            )}
          </div>
        </button>

        {/* Alert History Panel */}
        {isHistoryOpen && (
          <div className="absolute right-0 mt-2 w-80 bg-surface border border-white/[0.08] rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col max-h-[400px] z-50">
            {/* Accent line */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-400/50 to-transparent" />
            
            {/* Header */}
            <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-400 text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>
                  radar
                </span>
                <span className="text-amber-300 font-headline font-bold text-xs tracking-tight">Airspace Alert Log</span>
              </div>
              {alertHistory.length > 0 && (
                <button
                  onClick={() => {
                    setAlertHistory([]);
                    setUnreadCount(0);
                  }}
                  className="text-[9px] text-white/40 hover:text-white/80 uppercase tracking-widest font-semibold cursor-pointer bg-transparent border-none"
                >
                  Clear All
                </button>
              )}
            </div>

            {/* Content list */}
            <div className="flex-1 overflow-y-auto scrollbar-hide py-1 max-h-[320px]">
              {alertHistory.length === 0 ? (
                <div className="text-[10px] text-white/40 text-center py-8">
                  No alerts in this session
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {alertHistory.map((item) => {
                    const altFt = Math.round((item.altitude || 0) * 3.28084);
                    const spdKts = Math.round((item.speed || 0) * 1.94384);
                    const timeStr = item.timestamp.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
                    
                    return (
                      <div key={item.id} className="p-3 hover:bg-white/[0.02] transition-colors flex flex-col gap-1.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-xs font-mono font-extrabold text-white">{item.callsign}</span>
                            <span className="text-[8px] text-white/50 uppercase tracking-wide truncate max-w-[120px]">{item.type}</span>
                          </div>
                          <span className="text-[8px] text-white/30 font-mono">{timeStr}</span>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <div className="flex gap-3 text-[9px] text-white/50">
                            <span>Alt: <strong className="text-white/80">{altFt.toLocaleString()} ft</strong></span>
                            <span>Spd: <strong className="text-white/80">{spdKts} kts</strong></span>
                            <span>Dist: <strong className="text-white/80">{Math.round(item.distance)} km</strong></span>
                          </div>
                          
                          <button
                            onClick={() => {
                              setSelectedFlight(item.flight);
                              // On mobile, close history panel when locating
                              if (isMobile) {
                                setIsHistoryOpen(false);
                              }
                            }}
                            className="flex items-center gap-1 px-2 py-1 bg-amber-400/10 hover:bg-amber-400/20 text-amber-300 text-[8px] font-bold uppercase tracking-wider rounded transition-colors border border-amber-400/20 cursor-pointer animate-pulse-ring"
                          >
                            <span className="material-symbols-outlined text-[9px]">my_location</span>
                            Locate
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Active Toast Notifications ── */}
      <div 
        className="fixed z-50 flex flex-col gap-2 pointer-events-none"
        style={{
          top: '5.5rem',
          right: '1rem',
          maxWidth: 'min(280px, calc(100vw - 2rem))'
        }}
      >
        {alerts.map((alert) => (
          <ToastItem
            key={alert.id}
            alert={alert}
            onDismiss={(id) => setAlerts(prev => prev.filter(a => a.id !== id))}
            onLocate={(flight) => {
              setSelectedFlight(flight);
              setAlerts(prev => prev.filter(a => a.id !== alert.id));
            }}
          />
        ))}
      </div>

      {/* ── Sidebar ── */}
      <nav
        className={`fixed z-40 flex flex-col bg-white/[0.04] backdrop-blur-3xl rounded-2xl border border-white/[0.08] shadow-[0_20px_60px_rgba(0,0,0,0.5)] font-inter text-sm antialiased overflow-hidden transition-all duration-500 ease-out`}
        style={{
          // On mobile: slides in from left, never exceeds viewport width
          width: isMobile ? 'min(16rem, calc(100vw - 2rem))' : '16rem',
          top: '50%',
          left: '1rem',
          transform: isMobile
            ? (isSidebarOpen ? 'translateX(0) translateY(-50%)' : 'translateX(calc(-100% - 1rem)) translateY(-50%)')
            : 'translateX(0) translateY(-50%)',
          maxHeight: isMobile ? '80vh' : '85vh',
          opacity: isMobile ? (isSidebarOpen ? 1 : 0) : 1,
          pointerEvents: isMobile ? (isSidebarOpen ? 'auto' : 'none') : 'none',
        }}
      >


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
              <div className="text-[9px] text-slate-500 uppercase tracking-wider">50 km zone</div>
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
      {/* MOBILE: full-width strip anchored just above the icon nav bar */}
      {/* DESKTOP: fixed card on the right side */}
      {isMobile ? (
        <>
          {/* Transparent backdrop — tapping outside dismisses the card */}
          {selectedFlight && (
            <div
              className="fixed inset-0"
              style={{ zIndex: 48 }}
              onClick={() => setSelectedFlight(null)}
            />
          )}

          {/* Card */}
          <div
            className={`fixed left-0 right-0 font-inter transition-all duration-400 ${
              selectedFlight ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'
            }`}
            style={{ bottom: '7rem', zIndex: 50 }}
          >
            <div className="mx-3 bg-white/[0.04] backdrop-blur-3xl rounded-2xl border border-white/[0.08] shadow-[0_-8px_40px_rgba(0,0,0,0.5)] pointer-events-auto relative overflow-hidden">
              {/* Top accent gradient */}
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
              {/* Left accent bar */}
              <div className="absolute top-0 left-0 bottom-0 w-[2px] bg-gradient-to-b from-primary/60 via-primary/20 to-transparent rounded-l-2xl" />

              {/* Header */}
              <div className="flex items-start justify-between px-4 pt-3 pb-2 pl-5">
                <div className="flex-1 min-w-0 pr-3">
                  {/* Callsign + type */}
                  <div className="flex items-baseline gap-2 min-w-0">
                    <h2 className="text-[15px] font-headline font-extrabold text-white leading-none tracking-tight truncate">
                      {selectedFlight?.callsign || 'UNKNOWN'}
                    </h2>
                    {selectedFlight?.type && (
                      <span className="text-[10px] font-semibold text-on-surface/40 flex-shrink-0">{selectedFlight.type}</span>
                    )}
                  </div>
                  {/* Airline · reg · coords */}
                  <div className="flex items-center gap-1.5 mt-1 min-w-0 flex-wrap">
                    {(() => {
                      const airline = getAirlineFromCallsign(selectedFlight?.callsign);
                      return airline ? (
                        <span className="text-[10px] font-bold text-sky-400 uppercase tracking-wide">{airline}</span>
                      ) : null;
                    })()}
                    {selectedFlight?.country && (
                      <span className="text-[9px] text-on-surface/35 uppercase">· {selectedFlight.country}</span>
                    )}
                    <span className="text-on-surface/20 text-[9px]">·</span>
                    <span className="text-[9px] font-mono text-on-surface/35 truncate">
                      {selectedFlight?.latitude?.toFixed(3)}°N {selectedFlight?.longitude?.toFixed(3)}°E
                    </span>
                  </div>
                </div>

              </div>

              {/* Stats — single row with dividers */}
              <div className="flex items-stretch border-t border-white/[0.06] divide-x divide-white/[0.06] pb-3 pt-2.5">
                {[
                  { label: 'ALT',  value: Math.round((selectedFlight?.altitude || 0) * 3.28084).toLocaleString(), unit: 'ft'  },
                  { label: 'SPD',  value: Math.round((selectedFlight?.velocity || 0) * 1.94384),                  unit: 'kts' },
                  { label: 'HDG',  value: `${Math.round(selectedFlight?.true_track || 0)}°`,                      unit: ''    },
                  { label: 'SQWK', value: selectedFlight?.squawk || 'N/A',                                        unit: ''    },
                ].map(({ label, value, unit }) => (
                  <div key={label} className="flex-1 flex flex-col items-center justify-center gap-0.5 px-1">
                    <span className="text-[7px] font-bold text-on-surface/30 uppercase tracking-widest">{label}</span>
                    <span className="text-[13px] font-headline font-bold text-on-surface leading-none">
                      {value}<span className="text-[8px] font-normal opacity-35 ml-0.5">{unit}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      ) : (
        /* ── Desktop right-side card (unchanged) ── */
        <main
          className={`fixed z-40 font-inter transition-all duration-500 bottom-16 right-6 w-80 ${
            selectedFlight ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'
          }`}
        >
          <div className="bg-white/[0.04] backdrop-blur-3xl rounded-2xl border border-white/[0.08] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.5)] flex flex-col pointer-events-auto relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
            <div className="flex justify-between items-start mb-4">
              <div className="min-w-0 flex-1">
                <h2 className="text-2xl font-headline font-extrabold text-primary-fixed-dim leading-none truncate">
                  {selectedFlight?.callsign || 'UNKNOWN'} — {selectedFlight?.type || ''}
                </h2>
                {(() => {
                  const airline = getAirlineFromCallsign(selectedFlight?.callsign);
                  return airline ? <p className="text-[11px] font-bold text-sky-400 uppercase tracking-widest mt-1.5">{airline}</p> : null;
                })()}
                <p className="text-[10px] text-on-surface-variant uppercase tracking-widest mt-1">{selectedFlight?.country || 'NA'}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Altitude', value: `${Math.round((selectedFlight?.altitude || 0) * 3.28084)}`, unit: 'ft' },
                { label: 'Speed',    value: `${Math.round((selectedFlight?.velocity || 0) * 1.94384)}`, unit: 'kts' },
                { label: 'Heading',  value: `${Math.round(selectedFlight?.true_track || 0)}°`,          unit: '' },
                { label: 'Squawk',   value: selectedFlight?.squawk || 'N/A',                            unit: '' },
              ].map(({ label, value, unit }) => (
                <div key={label} className="p-3 bg-white/[0.03] rounded-xl border border-white/5 text-center">
                  <p className="text-[9px] text-on-surface-variant uppercase tracking-wider mb-1">{label}</p>
                  <p className="text-lg font-headline font-bold text-on-surface leading-none">
                    {value}<span className="text-[10px] ml-1 font-normal opacity-40">{unit}</span>
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-white/5">
              <div className="flex items-center gap-2 mb-3">
                <span className="material-symbols-outlined text-sm text-primary/60">location_on</span>
                <span className="text-[11px] font-mono text-on-surface-variant">
                  {selectedFlight?.latitude?.toFixed(4)}° N, {selectedFlight?.longitude?.toFixed(4)}° E
                </span>
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
      )}

      {/* ── Mobile: unified 5-icon navigation bar (replaces FABs + analytics nav) ── */}
      {isMobile && !selectedFlight && (
        <nav
          className="fixed left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 p-1 bg-white/[0.04] backdrop-blur-3xl rounded-2xl border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.5)] pointer-events-auto"
          style={{ bottom: 'calc(2rem + 0.5rem)' }}
        >
          {[
            { id: 'sidebar',  icon: 'radar' },
            { id: 'traffic',  icon: 'connecting_airports' },
            { id: 'overview', icon: 'dashboard' },
            { id: 'fleet',    icon: 'flight' },
            { id: 'recent',   icon: 'history' },
          ].map(({ id, icon }) => {
            const isActive =
              id === 'sidebar'  ? isSidebarOpen  :
              id === 'traffic'  ? isTrafficOpen  :
              activeAnalyticsTab === id;
            return (
              <button
                key={id}
                onClick={() => handlePanelToggle(id)}
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 cursor-pointer border ${
                  isActive
                    ? 'bg-primary/20 text-primary border-primary/30 shadow-inner'
                    : 'bg-transparent text-on-surface/60 border-transparent hover:bg-white/10 hover:text-white'
                }`}
                style={{ minWidth: 40, minHeight: 40 }}
              >
                <span
                  className="material-symbols-outlined text-[18px]"
                  style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}
                >
                  {icon}
                </span>
              </button>
            );
          })}
        </nav>
      )}

      {/* ── Desktop: 3-tab analytics navbar (unchanged) ── */}
      {!isMobile && (
        <nav
          className="fixed left-1/2 transform -translate-x-1/2 z-50 flex items-center gap-2 p-1.5 bg-white/[0.04] backdrop-blur-3xl rounded-2xl border border-white/[0.08] shadow-[0_20px_60px_rgba(0,0,0,0.5)] pointer-events-auto transition-all duration-300"
          style={{ bottom: 'calc(2rem + 0.5rem)' }}
        >
          {[
            { id: 'overview', icon: 'dashboard', label: 'Overview' },
            { id: 'fleet',    icon: 'flight',    label: 'Fleet'    },
            { id: 'recent',   icon: 'history',   label: 'Recent'   },
          ].map(tab => {
            const isActive = activeAnalyticsTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveAnalyticsTab(isActive ? null : tab.id);
                  setIsSidebarOpen(false);
                  setIsTrafficOpen(false);
                  setSelectedFlight(null);
                }}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all duration-200 cursor-pointer ${
                  isActive
                    ? 'bg-primary/20 text-primary border border-primary/30 shadow-inner'
                    : 'bg-transparent text-on-surface/70 hover:bg-white/5 border border-transparent hover:text-white'
                }`}
                style={{ minHeight: 40 }}
              >
                <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}>{tab.icon}</span>
                <span className="text-[11px] font-headline font-bold uppercase tracking-widest">{tab.label}</span>
              </button>
            );
          })}
        </nav>
      )}

      {/* ── Footer ── */}
      <footer className="fixed bottom-0 w-full z-50 flex justify-between items-center px-4 sm:px-8 py-2 sm:py-2.5 bg-white/[0.03] backdrop-blur-xl border-t border-white/5 font-inter text-[9px] sm:text-[10px] tracking-widest uppercase pointer-events-none overflow-hidden">
        <div className="flex items-center gap-3 sm:gap-4 pointer-events-auto">
          <div className="flex items-center gap-2">


          </div>

          <span className="text-slate-500">
            <span className="text-on-surface font-medium">{flights.length}</span> flight(s)
            {visibleCount < flights.length && <span className="text-slate-600"> • {visibleCount} shown</span>}
          </span>
        </div>
        <div className="flex items-center gap-3 sm:gap-4 pointer-events-auto">
          <span className="text-slate-600 hidden sm:block">{new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })}</span>


        </div>
      </footer>
      <SmoothCursor />
    </>
  );
}

export default App;
