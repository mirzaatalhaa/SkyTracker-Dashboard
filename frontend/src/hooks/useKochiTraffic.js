import { useState, useEffect, useRef } from 'react';

// AviationStack via Vercel Serverless Function Proxy
// This solves the Mixed Content (HTTP vs HTTPS) issue on Vercel

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
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error?.message || 'Failed to fetch from backend proxy');
      }
      
      const json = await res.json();
      arrFlights = json.data.arrivals || [];
      depFlights = json.data.departures || [];

      // Count landed/active arrivals
      const landedCount = arrFlights.filter(f => 
        f.flight_status === 'landed' || f.flight_status === 'active'
      ).length;
      
      // Count active/landed departures
      const departedCount = depFlights.filter(f =>
        f.flight_status === 'active' || f.flight_status === 'landed'
      ).length;

      // Format recent flights
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

      // Cache
      saveCache({
        arrivals: landedCount,
        departures: departedCount,
        recentArrivals: recentArr,
        recentDepartures: recentDep,
        lastUpdated: Date.now(),
      });
    } catch (err) {
      console.error('Kochi traffic fetch failed:', err);
      setError(err.message === 'Failed to fetch' ? 'Proxy Connection Failed' : err.message);
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

      // Only fetch if data is older than our FETCH_INTERVAL
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
