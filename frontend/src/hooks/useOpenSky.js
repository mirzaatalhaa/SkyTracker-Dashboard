import { useState, useEffect, useRef } from 'react';

const mapFlightData = (ac) => ({
  icao24: ac.hex,
  callsign: ac.flight ? ac.flight.trim() : 'UNKNOWN',
  country: ac.r || 'Unknown', // Registration country if available
  longitude: ac.lon,
  latitude: ac.lat,
  altitude: ac.alt_baro ? (ac.alt_baro / 3.28084) : 0, // Convert ft to meters
  velocity: ac.gs ? (ac.gs / 1.94384) : 0, // Convert knots to m/s
  true_track: ac.track || 0,
  vertical_rate: ac.baro_rate ? (ac.baro_rate / 196.85) : 0, // Convert ft/min to m/s
  squawk: ac.squawk || 'N/A',
  category: ac.category || 0,
  type: ac.t || ''
});

export const useOpenSky = () => {
  const [flights, setFlights] = useState([]);
  const [bounds, setBounds] = useState(null);
  const lastFetchTime = useRef(0);

  useEffect(() => {
    let intervalId;
    
    const fetchFlights = async () => {
      if (!bounds) return;
      
      const now = Date.now();
      if (now - lastFetchTime.current < 5000) return; // Prevent spamming
      
      // Calculate center of bounds to fetch from Airplanes.live radial endpoint
      const lat = (bounds._southWest.lat + bounds._northEast.lat) / 2;
      const lon = (bounds._southWest.lng + bounds._northEast.lng) / 2;
      
      // Roughly 250 nautical miles radius covers typical zoom level 8/9 on a screen
      const url = `/api/v1/flights?lat=${lat}&lon=${lon}&radius=250`;
      
      try {
        const res = await fetch(url);
        
        if (res.ok) {
          const json = await res.json();
          const data = json.data;
          if (data && data.ac) {
            // Filter flights that are inside our actual viewport bounds
            const mapped = data.ac
              .filter(ac => 
                ac.lat && ac.lon &&
                ac.lat >= bounds._southWest.lat && ac.lat <= bounds._northEast.lat &&
                ac.lon >= bounds._southWest.lng && ac.lon <= bounds._northEast.lng
              )
              .map(mapFlightData);
            
            setFlights(mapped);
            lastFetchTime.current = Date.now();
          } else {
            setFlights([]);
          }
        } else {
          console.error(`Airplanes.live API Error: ${res.status} ${res.statusText}`);
        }
      } catch (err) {
        console.error("Failed to fetch flight data", err);
      }
    };

    fetchFlights();
    intervalId = setInterval(fetchFlights, 10000);

    return () => clearInterval(intervalId);
  }, [bounds]);

  return { flights, setBounds };
};
