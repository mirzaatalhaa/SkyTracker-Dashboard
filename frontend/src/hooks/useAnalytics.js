import { useState, useEffect, useRef, useCallback } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// useAnalytics — fetches all analytics data from the backend
//
// DATA FLOW EXPLANATION:
//
//   Backend (PostgreSQL)
//     └─► Express analytics routes (/api/v1/analytics/*)
//           └─► Vite dev proxy (/api → http://localhost:3001)
//                 └─► useAnalytics hook (fetch + useState)
//                       └─► AnalyticsDashboard component (renders)
//
// Each endpoint is fetched independently so one slow query cannot block
// the rest of the dashboard from rendering. React renders partial data
// as it arrives — the "loading" state per-section creates this effect.
//
// POLLING STRATEGY:
// Analytics data changes on a ~2-minute cycle (the background collector interval).
// Polling every 60 seconds is a reasonable compromise — we'll catch new data
// within one collector cycle, without hammering the backend.
//
// We do NOT use WebSockets or SSE here because:
//   - Analytics is not real-time (it's historical aggregation)
//   - A 60s polling window is perfectly acceptable for trend data
//   - This keeps the architecture simple and stateless
// ─────────────────────────────────────────────────────────────────────────────

const ANALYTICS_POLL_INTERVAL = 60 * 1000; // 60 seconds

const fetchJSON = async (url) => {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error?.message || `HTTP ${res.status}`);
  }
  return res.json();
};

export const useAnalytics = () => {
  // ── State for each analytics dataset ──────────────────────────────────────
  // Each dataset has its own loading/error state so they render independently.
  const [flightCount, setFlightCount] = useState(null);
  const [flightCountLoading, setFlightCountLoading] = useState(true);
  const [flightCountError, setFlightCountError] = useState(null);

  const [aircraftTypes, setAircraftTypes] = useState([]);
  const [aircraftTypesLoading, setAircraftTypesLoading] = useState(true);
  const [aircraftTypesError, setAircraftTypesError] = useState(null);

  const [recentFlights, setRecentFlights] = useState([]);
  const [recentFlightsLoading, setRecentFlightsLoading] = useState(true);
  const [recentFlightsError, setRecentFlightsError] = useState(null);

  const [lastFetchedAt, setLastFetchedAt] = useState(null);
  const timerRef = useRef(null);

  // ── Fetch functions (individual so failures are isolated) ─────────────────
  const fetchFlightCount = useCallback(async () => {
    setFlightCountLoading(true);
    setFlightCountError(null);
    try {
      const json = await fetchJSON('/api/v1/analytics/flights/count');
      setFlightCount(json.data.total);
    } catch (err) {
      setFlightCountError(err.message);
    } finally {
      setFlightCountLoading(false);
    }
  }, []);

  const fetchAircraftTypes = useCallback(async () => {
    setAircraftTypesLoading(true);
    setAircraftTypesError(null);
    try {
      const json = await fetchJSON('/api/v1/analytics/flights/aircraft-types');
      // Transform backend data into Recharts-ready format.
      // Backend returns: [{ aircraft: "A20N", count: "5" }]
      // Recharts needs:  [{ name: "A20N", value: 5 }]
      // The count comes as a STRING from PostgreSQL's COUNT() — parseInt is required.
      const transformed = json.data.map(row => ({
        name: row.aircraft || 'Unknown',
        value: parseInt(row.count, 10),
      }));
      setAircraftTypes(transformed);
    } catch (err) {
      setAircraftTypesError(err.message);
    } finally {
      setAircraftTypesLoading(false);
    }
  }, []);

  const fetchRecentFlights = useCallback(async () => {
    setRecentFlightsLoading(true);
    setRecentFlightsError(null);
    try {
      // Limit to 20 — enough for a meaningful table without excessive DOM nodes
      const json = await fetchJSON('/api/v1/analytics/flights/recent?limit=20');
      setRecentFlights(json.data);
    } catch (err) {
      setRecentFlightsError(err.message);
    } finally {
      setRecentFlightsLoading(false);
    }
  }, []);

  const fetchAll = useCallback(async () => {
    // Fire all fetches in parallel — Promise.allSettled ensures one failure
    // doesn't cancel the others (unlike Promise.all)
    await Promise.allSettled([
      fetchFlightCount(),
      fetchAircraftTypes(),
      fetchRecentFlights(),
    ]);
    setLastFetchedAt(new Date());
  }, [fetchFlightCount, fetchAircraftTypes, fetchRecentFlights]);

  // ── Initial fetch + polling setup ─────────────────────────────────────────
  useEffect(() => {
    fetchAll();
    timerRef.current = setInterval(fetchAll, ANALYTICS_POLL_INTERVAL);
    return () => clearInterval(timerRef.current);
  }, [fetchAll]);

  return {
    flightCount,
    flightCountLoading,
    flightCountError,

    aircraftTypes,
    aircraftTypesLoading,
    aircraftTypesError,

    recentFlights,
    recentFlightsLoading,
    recentFlightsError,

    lastFetchedAt,
    refresh: fetchAll,
  };
};
