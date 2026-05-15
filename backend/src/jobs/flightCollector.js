import axios from 'axios';
import { saveFlightSnapshot } from '../services/snapshotService.js';

// ─────────────────────────────────────────────────────────────────────────────
// Collection Configuration
// These constants define what area we continuously monitor.
// Hardcoded to Cochin International Airport (COK) for Phase 4.
// Phase 6/7 can promote these to environment variables.
// ─────────────────────────────────────────────────────────────────────────────
const COK_LAT = 10.1518;
const COK_LON = 76.3930;
const COK_RADIUS_KM = 250;
const API_TIMEOUT_MS = 8000; // Slightly more generous than the on-demand endpoint

// ─────────────────────────────────────────────────────────────────────────────
// Concurrency Guard
// Prevents a slow run from stacking up if the next cron tick fires before the
// previous one finishes. This is the in-process equivalent of a job lock.
// ─────────────────────────────────────────────────────────────────────────────
let isRunning = false;

/**
 * The main collection function. Called by the scheduler on every cron tick.
 *
 * It is intentionally decoupled from any HTTP request/response cycle.
 * The backend now acts as a producer, not just a request handler.
 */
export const runFlightCollection = async () => {
  // Skip if the previous run hasn't finished yet
  if (isRunning) {
    console.log('[flightCollector] ⚠️  Skipping — previous run still in progress');
    return;
  }

  isRunning = true;
  const runStart = Date.now();
  console.log(`[flightCollector] ⏰ Run started at ${new Date().toISOString()}`);

  try {
    // ── Step 1: Fetch from airplanes.live ────────────────────────────────────
    const url = `https://api.airplanes.live/v2/point/${COK_LAT}/${COK_LON}/${COK_RADIUS_KM}`;
    const fetchStart = Date.now();
    const response = await axios.get(url, { timeout: API_TIMEOUT_MS });
    const fetchDuration = Date.now() - fetchStart;

    const aircraft = response.data?.ac;

    if (!aircraft || aircraft.length === 0) {
      console.log(`[flightCollector] ℹ️  No aircraft found in area. Fetch took ${fetchDuration}ms`);
      return;
    }

    console.log(`[flightCollector] ✅ Fetched ${aircraft.length} aircraft from airplanes.live in ${fetchDuration}ms`);

    // ── Step 2: Persist to PostgreSQL ────────────────────────────────────────
    // Re-uses the same saveFlightSnapshot from snapshotService to keep the
    // write logic in one place (DRY principle). The service handles transactions.
    await saveFlightSnapshot(aircraft);

    const totalDuration = Date.now() - runStart;
    console.log(`[flightCollector] ✅ Run completed in ${totalDuration}ms`);

  } catch (error) {
    const totalDuration = Date.now() - runStart;

    // Distinguish between API errors and DB errors for clearer diagnostics
    if (error.code === 'ECONNABORTED') {
      console.error(`[flightCollector] ❌ API timeout after ${API_TIMEOUT_MS}ms — skipping this run`);
    } else if (error.response) {
      console.error(`[flightCollector] ❌ API returned HTTP ${error.response.status} — ${error.message}`);
    } else {
      console.error(`[flightCollector] ❌ Run failed in ${totalDuration}ms:`, error.message);
    }
  } finally {
    // Always release the lock, even on error. This prevents the job from
    // permanently locking itself out if an exception is thrown.
    isRunning = false;
  }
};
