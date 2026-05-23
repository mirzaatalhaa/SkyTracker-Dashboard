import React, { useRef, useEffect, useMemo } from 'react';
import { Marker } from 'react-leaflet';
import L from 'leaflet';

// Global icon cache — keyed by `${icao24}-${isSelected}`
const iconCache = new Map();
const MAX_CACHE_SIZE = 2000;

const getPlaneHtml = (flight, isSelected) => {
  const { true_track } = flight;

  // Simplified HTML — removed heavy classes and inline hover effects
  // that cause style recalculations on hundreds of DOM nodes
  const color = isSelected ? '#a2c9ff' : '#c3cad5';
  const glow = isSelected ? 'filter: drop-shadow(0 0 6px rgba(162,201,255,0.7));' : '';

  return `<div style="width:44px;height:44px;display:flex;align-items:center;justify-content:center;cursor:pointer;">
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="${color}" style="transform:rotate(${true_track}deg);${glow}">
      <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
    </svg>
  </div>`;
};

const createIcon = (flight, isSelected) => {
  return L.divIcon({
    html: getPlaneHtml(flight, isSelected),
    className: '',
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });
};

const getCachedIcon = (flight, isSelected) => {
  // Cache by heading bucket (round to 5°) + selection state
  // This lets flights with similar headings share the same icon instance
  const headingBucket = Math.round((flight.true_track || 0) / 5) * 5;
  const key = `${headingBucket}-${isSelected ? 1 : 0}`;
  
  let icon = iconCache.get(key);
  if (!icon) {
    // Evict oldest entries if cache is too large
    if (iconCache.size > MAX_CACHE_SIZE) {
      const firstKey = iconCache.keys().next().value;
      iconCache.delete(firstKey);
    }
    icon = createIcon({ ...flight, true_track: headingBucket }, isSelected);
    iconCache.set(key, icon);
  }
  return icon;
};

// Stateless component purely for holding the Ref and initial mount position
const FlightMarkerInner = ({ flight, isSelected, onClick, aircraftRefs }) => {
  const markerRef = useRef(null);

  useEffect(() => {
    if (markerRef.current) {
      const aircraft = aircraftRefs.current.get(flight.icao24);
      if (aircraft) {
        // Link the Leaflet instance imperatively so App.js loop can update it
        aircraft.markerRef = markerRef.current;
      }
    }
  }, [flight.icao24, aircraftRefs]);

  // Use cached icon — huge perf win when hundreds of markers share heading buckets
  const icon = useMemo(
    () => getCachedIcon(flight, isSelected),
    [Math.round((flight.true_track || 0) / 5) * 5, isSelected]
  );

  // Position is ONLY used on initial mount.
  // We disable React state lat/lng updates to boost performance.
  return (
    <Marker 
      ref={markerRef}
      position={[flight.latitude, flight.longitude]} 
      icon={icon} 
      eventHandlers={{ click: () => onClick(flight) }} 
    />
  );
};

// Deep comparison memo — only re-render if selection state or heading significantly changed
export const FlightMarker = React.memo(FlightMarkerInner, (prevProps, nextProps) => {
  // Return true to SKIP re-render
  if (prevProps.isSelected !== nextProps.isSelected) return false;
  if (prevProps.flight.icao24 !== nextProps.flight.icao24) return false;
  
  // Only re-render if heading changed by more than 5 degrees
  const prevHeading = Math.round((prevProps.flight.true_track || 0) / 5) * 5;
  const nextHeading = Math.round((nextProps.flight.true_track || 0) / 5) * 5;
  if (prevHeading !== nextHeading) return false;
  
  return true; // Skip re-render — position is handled imperatively
});
