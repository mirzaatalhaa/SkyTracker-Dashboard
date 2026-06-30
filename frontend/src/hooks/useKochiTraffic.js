import { useState, useEffect, useRef } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// IMPORTANT: This hook polls the backend cache every 10 minutes via
// GET /api/v1/traffic/cok. It NEVER triggers an AviationStack API call.
// The backend serves cached data exclusively. AviationStack is only called
// by the server's scheduled daily refresh job (see backend/src/jobs/scheduler.js).
//
// Do NOT "optimize" this by adding direct AviationStack calls from the frontend.
// The AviationStack free tier has a strict 100 calls/month quota.
// ─────────────────────────────────────────────────────────────────────────────

const CACHE_KEY = 'cok_traffic_cache_v2';
const FETCH_INTERVAL = 10 * 60 * 1000; // Refresh every 10 minutes

const getTodayStr = () => new Date().toISOString().slice(0, 10);

const loadCache = () => {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (data.date === getTodayStr()) return data;
    }
  } catch {/* ignore */}
  return null;
};

const saveCache = (data) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ...data, date: getTodayStr() }));
  } catch {/* ignore */}
};

export const useKochiTraffic = () => {
  const [arrivals, setArrivals] = useState(0);
  const [departures, setDepartures] = useState(0);
  const [recentArrivals, setRecentArrivals] = useState([]);
  const [recentDepartures, setRecentDepartures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const fetchTimerRef = useRef(null);

  const fetchTraffic = async () => {
    try {
      let arrFlights = [];
      let depFlights = [];

      const res = await fetch('/api/v1/traffic/cok');
      let json = null;
      let errorMsg = 'Failed to fetch from backend proxy';

      try {
        json = await res.json();
      } catch (_) {
        if (!res.ok) {
          if (res.status === 504) {
            throw new Error('Request timeout');
          }
          throw new Error(`HTTP Error ${res.status}`);
        }
      }

      if (!res.ok) {
        const backendError = json?.error?.message || json?.error || 'Unknown error';
        
        if (res.status === 401 || json?.error?.code === 'invalid_access_key') {
          errorMsg = 'Invalid API key';
        } else if (res.status === 429 || json?.error?.code === 'usage_limit_reached' || json?.error?.code === 'monthly_limit_reached') {
          errorMsg = 'API quota exceeded';
        } else if (res.status === 504 || json?.error?.code === 'TIMEOUT') {
          errorMsg = 'Request timeout';
        } else {
          errorMsg = backendError;
        }
        throw new Error(errorMsg);
      }

      arrFlights = json.data.arrivals || [];
      depFlights = json.data.departures || [];

      if (arrFlights.length === 0 && depFlights.length === 0) {
        setError('No data available');
        setArrivals(0);
        setDepartures(0);
        setRecentArrivals([]);
        setRecentDepartures([]);
        setLastUpdated(new Date());
        return;
      }

      const landedCount = arrFlights.filter(f => 
        f.flight_status === 'landed' || f.flight_status === 'active'
      ).length;
      
      const departedCount = depFlights.filter(f =>
        f.flight_status === 'active' || f.flight_status === 'landed'
      ).length;

      const recentArr = arrFlights
        .filter(f => f.flight_status === 'landed' || f.flight_status === 'active')
        .slice(0, 5)
        .map(f => ({
          flight: f.flight?.iata || f.flight?.icao || 'N/A',
          airline: f.airline?.name || 'Unknown',
          from: f.departure?.iata || '???',
          status: f.flight_status,
          time: f.arrival?.actual || f.arrival?.estimated || f.arrival?.scheduled || '',
        }));

      const recentDep = depFlights
        .filter(f => f.flight_status === 'active' || f.flight_status === 'landed')
        .slice(0, 5)
        .map(f => ({
          flight: f.flight?.iata || f.flight?.icao || 'N/A',
          airline: f.airline?.name || 'Unknown',
          to: f.arrival?.iata || '???',
          status: f.flight_status,
          time: f.departure?.actual || f.departure?.estimated || f.departure?.scheduled || '',
        }));

      setArrivals(landedCount);
      setDepartures(departedCount);
      setRecentArrivals(recentArr);
      setRecentDepartures(recentDep);
      setLastUpdated(new Date());
      setError(null);

      saveCache({
        arrivals: landedCount,
        departures: departedCount,
        recentArrivals: recentArr,
        recentDepartures: recentDep,
        lastUpdated: Date.now(),
      });
    } catch (err) {
      console.error('Kochi traffic fetch failed:', err);
      
      let displayError = err.message;
      if (err.message === 'Failed to fetch' || err.name === 'TypeError') {
        displayError = 'Backend unreachable';
      }
      
      setError(displayError);

      const cached = loadCache();
      if (!cached) {
        const now = new Date();
        const formatMockTime = (offsetMins) => {
          return new Date(now.getTime() + offsetMins * 60000).toISOString();
        };

        setArrivals(14);
        setDepartures(11);
        setRecentArrivals([
          { flight: 'AI-402', airline: 'Air India', from: 'DEL', status: 'landed', time: formatMockTime(-25) },
          { flight: 'EK-530', airline: 'Emirates', from: 'DXB', status: 'landed', time: formatMockTime(-55) },
          { flight: '6E-241', airline: 'IndiGo', from: 'BOM', status: 'active', time: formatMockTime(10) },
          { flight: 'IX-382', airline: 'Air India Express', from: 'SIN', status: 'active', time: formatMockTime(35) }
        ]);
        setRecentDepartures([
          { flight: '6E-5302', airline: 'IndiGo', to: 'BLR', status: 'active', time: formatMockTime(-15) },
          { flight: 'IX-434', airline: 'Air India Express', to: 'SHJ', status: 'active', time: formatMockTime(-40) },
          { flight: 'QR-517', airline: 'Qatar Airways', to: 'DOH', status: 'landed', time: formatMockTime(-95) },
          { flight: 'SG-92', airline: 'SpiceJet', to: 'MAA', status: 'active', time: formatMockTime(15) }
        ]);
        setLastUpdated(now);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const cached = loadCache();
    let shouldFetch = true;

    if (cached) {
      setArrivals(cached.arrivals);
      setDepartures(cached.departures);
      setRecentArrivals(cached.recentArrivals || []);
      setRecentDepartures(cached.recentDepartures || []);
      setLastUpdated(cached.lastUpdated ? new Date(cached.lastUpdated) : null);
      setLoading(false);

      if (cached.lastUpdated && (Date.now() - cached.lastUpdated < FETCH_INTERVAL)) {
        shouldFetch = false;
      }
    }

    if (shouldFetch) {
      fetchTraffic();
    }

    fetchTimerRef.current = setInterval(fetchTraffic, FETCH_INTERVAL);
    return () => clearInterval(fetchTimerRef.current);
  }, []);

  return {
    arrivals,
    departures,
    total: arrivals + departures,
    recentArrivals,
    recentDepartures,
    loading,
    error,
    lastUpdated,
  };
};
