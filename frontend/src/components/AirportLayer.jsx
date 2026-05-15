import React, { useState } from 'react';
import { Marker, Popup, Tooltip, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

// A subtle, minimalist dark/glass SVG icon for airports
// Kept intentionally simple and non-intrusive vs. bright aircraft markers
const makeAirportIcon = () => L.divIcon({
  html: `
    <div class="flex items-center justify-center w-full h-full relative cursor-pointer">
      <div class="w-3 h-3 bg-primary/20 rounded-full border border-primary/40 shadow-[0_0_10px_rgba(77,163,255,0.3)]"></div>
      <div class="absolute w-1 h-1 bg-primary rounded-full"></div>
    </div>
  `,
  className: '',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
  popupAnchor: [0, -10]
});

// Create once outside component to prevent recreation on re-renders
const airportIcon = makeAirportIcon();

export const AirportLayer = ({ airports }) => {
  const ZOOM_THRESHOLD = 6;
  const [shouldRender, setShouldRender] = useState(false); // Initially false to prevent clustering globally on mount

  // Tap into leaflet's global map events system from inside this child component
  // so we dynamically show/hide the airport DOM nodes without re-rendering the parent App
  const map = useMapEvents({
    zoomend: () => {
      const currentZoom = map.getZoom();
      setShouldRender(currentZoom >= ZOOM_THRESHOLD);
    },
    // We also hook on load or initial zoom if react-leaflet doesn't fire it automatically
    load: () => {
      setShouldRender(map.getZoom() >= ZOOM_THRESHOLD);
    }
  });

  // Manual initialization check because 'load' event might have passed before this mounted
  React.useEffect(() => {
    if (map) {
      setShouldRender(map.getZoom() >= ZOOM_THRESHOLD);
    }
  }, [map]);


  const [activePopup, setActivePopup] = useState(null);

  if (!shouldRender || !airports || airports.length === 0) return null;

  return (
    <>
      {airports.map((airport) => (
        <Marker
          key={airport.icao}
          position={[airport.lat, airport.lng]}
          icon={airportIcon}
          eventHandlers={{
            popupopen: () => setActivePopup(airport.icao),
            popupclose: () => setActivePopup(null)
          }}
        >
          {/* Subtle Hover Context (hidden when popup is active) */}
          {activePopup !== airport.icao && (
            <Tooltip direction="top" offset={[0, -10]} opacity={1} className="custom-tooltip border-none bg-transparent shadow-none">
              <div className="px-3 py-1.5 text-[10px] font-inter uppercase tracking-widest text-primary-container bg-white/[0.04] border border-white/[0.08] backdrop-blur-2xl rounded-lg shadow-[0_8px_20px_rgba(0,0,0,0.4)]">
                {airport.iata} - {airport.name}
              </div>
            </Tooltip>
          )}

          {/* Deep Clicking Context matching the App's glassmorphism tokens */}
          <Popup className="custom-popup border-none bg-transparent" closeButton={false} offset={[0, -10]}>
            <div className="flex flex-col items-center">
              <div className="bg-white/[0.04] backdrop-blur-3xl rounded-[2rem] border border-white/[0.08] p-6 shadow-[0_20px_40px_rgba(0,0,0,0.6)] min-w-[260px] relative">
                {/* Custom Close Button inside the oval */}
                <button
                  onClick={(e) => { e.stopPropagation(); map.closePopup(); }}
                  className="absolute top-5 right-5 w-6 h-6 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/20 text-white/50 hover:text-white transition-colors cursor-pointer border border-white/10"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>close</span>
                </button>

                <div className="flex flex-col items-start mb-3 border-b border-white/10 pb-3 pr-8">
                  <h3 className="text-base font-headline font-bold text-white tracking-tight leading-tight">{airport.name}</h3>
                  <span className="px-1.5 py-0.5 mt-1 text-[8px] bg-primary/20 text-primary-fixed-dim rounded uppercase border border-primary/20">{airport.icao}</span>
                </div>

                <div className="flex flex-col gap-2 mt-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-white/50 uppercase tracking-widest">IATA</span>
                    <span className="text-xs font-mono text-white/90">{airport.iata}</span>
                  </div>
                  {(airport.city || airport.country) && (
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-[10px] text-white/50 uppercase tracking-widest">Location</span>
                      <span className="text-xs text-white/90">{airport.city}{airport.city && airport.country ? ', ' : ''}{airport.country}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  );
};
