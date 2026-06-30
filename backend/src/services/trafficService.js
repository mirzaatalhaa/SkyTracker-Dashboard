import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from '../config/env.js';

// ─────────────────────────────────────────────────────────────────────────────
// AviationStack API Budget
//
// MAX_DAILY_API_CALLS = 2 (1 arrivals + 1 departures per refresh cycle)
//
//   2 calls/day × 31 days = 62 calls/month — well under the 100/month quota.
//   This leaves a 38-call buffer for manual refreshes, retries after outages,
//   or occasional extra deploys with runOnStart.
//
// ⚠️  Changing this constant directly impacts monthly billing. Do so deliberately.
// ─────────────────────────────────────────────────────────────────────────────
const MAX_DAILY_API_CALLS = 2;

const COK_IATA = 'COK';

// ─────────────────────────────────────────────────────────────────────────────
// Persistent Call Counter
//
// Stored as a JSON file so the counter survives server restarts, redeploys,
// and process crashes. The file is tiny (<100 bytes) so sync I/O is fine.
// ─────────────────────────────────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../data');
const COUNTER_FILE = path.join(DATA_DIR, 'api-call-counter.json');

/**
 * Returns today's date string in YYYY-MM-DD format (local time).
 */
const getTodayStr = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

/**
 * Reads the persistent call counter. Auto-resets if the date has rolled over.
 * @returns {{ date: string, callsMade: number }}
 */
const readCounter = () => {
  const today = getTodayStr();
  try {
    if (fs.existsSync(COUNTER_FILE)) {
      const raw = fs.readFileSync(COUNTER_FILE, 'utf-8');
      const data = JSON.parse(raw);
      if (data.date === today) {
        return data;
      }
    }
  } catch (err) {
    console.error('[trafficService] ⚠️  Failed to read counter file, resetting:', err.message);
  }
  // Date rolled over or file missing/corrupt — start fresh
  return { date: today, callsMade: 0 };
};

/**
 * Writes the call counter to disk.
 * @param {{ date: string, callsMade: number }} counter
 */
const writeCounter = (counter) => {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(COUNTER_FILE, JSON.stringify(counter, null, 2), 'utf-8');
  } catch (err) {
    console.error('[trafficService] ❌ Failed to write counter file:', err.message);
  }
};

/**
 * Checks whether we are allowed to make more API calls today.
 * @returns {boolean}
 */
const canMakeApiCall = () => {
  const counter = readCounter();
  return counter.callsMade < MAX_DAILY_API_CALLS;
};

/**
 * Increments today's call counter by the given amount and persists it.
 * @param {number} count - Number of calls to add (default 2 for a full refresh)
 */
const incrementCounter = (count = 2) => {
  const counter = readCounter();
  counter.callsMade += count;
  writeCounter(counter);
  console.log(`[trafficService] 📊 API call counter: ${counter.callsMade}/${MAX_DAILY_API_CALLS} for ${counter.date}`);
};

// ─────────────────────────────────────────────────────────────────────────────
// In-Memory Cache
//
// Persists until the next scheduled refresh (~24h). There is NO time-based
// expiry — the daily call budget and scheduler control when data is refreshed.
// ─────────────────────────────────────────────────────────────────────────────
let trafficCache = null;
let cacheLastRefreshed = null;

// Add interceptor to log external API request timing
axios.interceptors.request.use(reqConfig => {
  reqConfig.metadata = { startTime: new Date() };
  return reqConfig;
});

axios.interceptors.response.use(response => {
  const duration = new Date() - response.config.metadata.startTime;
  console.log(`[Backend -> External] GET ${response.config.url.split('?')[0]} - ${duration}ms`); // Hide API key in logs
  return response;
}, error => {
  if (error.config) {
    const duration = new Date() - error.config.metadata.startTime;
    console.error(`[Backend -> External] ERROR GET ${error.config.url.split('?')[0]} - ${duration}ms - ${error.message}`);
  }
  return Promise.reject(error);
});

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the current in-memory traffic cache.
 *
 * This is what the GET /api/v1/traffic/cok endpoint calls.
 * It NEVER triggers an AviationStack API call — it only serves whatever
 * data was fetched by the last scheduled or manual refresh.
 *
 * @returns {{ arrivals: Array, departures: Array, lastRefreshed: string|null } | null}
 */
export const getCachedTraffic = () => {
  if (!trafficCache) return null;
  return {
    ...trafficCache,
    lastRefreshed: cacheLastRefreshed ? cacheLastRefreshed.toISOString() : null,
  };
};

/**
 * Fetches fresh arrivals and departures from AviationStack and updates the cache.
 *
 * Called ONLY by:
 *   1. The scheduled daily refresh job (scheduler.js)
 *   2. The manual refresh endpoint (POST /api/v1/traffic/cok/refresh)
 *
 * Enforces the daily call budget — if the budget is exhausted, the call is
 * skipped and existing cached data is preserved.
 *
 * @param {{ source: string }} options - Who triggered the refresh (for logging)
 * @returns {{ arrivals: Array, departures: Array, skipped?: boolean }}
 */
export const refreshTrafficFromApi = async ({ source = 'unknown' } = {}) => {
  const apiKey = config.aviationStackKey;

  if (!apiKey) {
    const error = new Error('AviationStack API Key is not configured on the server.');
    error.status = 500;
    throw error;
  }

  // ── Budget Gate ──────────────────────────────────────────────────────────
  if (!canMakeApiCall()) {
    const counter = readCounter();
    console.warn(
      `[trafficService] 🚫 SKIPPED refresh (source: ${source}) — daily budget exhausted ` +
      `(${counter.callsMade}/${MAX_DAILY_API_CALLS} calls used for ${counter.date}). Serving stale cache.`
    );
    return { ...(trafficCache || { arrivals: [], departures: [] }), skipped: true };
  }

  console.log(`[trafficService] 🔄 Refreshing COK traffic from AviationStack (source: ${source})...`);

  try {
    // Fetch arrivals and departures in parallel with HTTPS and a 10-second timeout
    const [arrRes, depRes] = await Promise.all([
      axios.get(`https://api.aviationstack.com/v1/flights?access_key=${apiKey}&arr_iata=${COK_IATA}&limit=100`, { timeout: 10000 }),
      axios.get(`https://api.aviationstack.com/v1/flights?access_key=${apiKey}&dep_iata=${COK_IATA}&limit=100`, { timeout: 10000 })
    ]);

    const arrData = arrRes.data;
    const depData = depRes.data;

    // AviationStack might return errors under HTTP 200 with an 'error' object
    if (arrData.error) {
      const err = arrData.error;
      console.error(`[trafficService] AviationStack API Error (Arrivals): Code=${err.code}, Message=${err.message}`);
      const customError = new Error(err.message || 'AviationStack API returned an error');
      customError.code = err.code;
      customError.status = err.code === 'invalid_access_key' ? 401 : (err.code === 'usage_limit_reached' ? 429 : 400);
      throw customError;
    }

    if (depData.error) {
      const err = depData.error;
      console.error(`[trafficService] AviationStack API Error (Departures): Code=${err.code}, Message=${err.message}`);
      const customError = new Error(err.message || 'AviationStack API returned an error');
      customError.code = err.code;
      customError.status = err.code === 'invalid_access_key' ? 401 : (err.code === 'usage_limit_reached' ? 429 : 400);
      throw customError;
    }

    // ── Success: update cache and counter ──────────────────────────────────
    trafficCache = {
      arrivals: arrData.data || [],
      departures: depData.data || [],
    };
    cacheLastRefreshed = new Date();

    // Increment counter ONLY after both calls succeeded
    incrementCounter(2);

    console.log(
      `[trafficService] ✅ Refresh complete (source: ${source}) at ${cacheLastRefreshed.toISOString()} — ` +
      `${trafficCache.arrivals.length} arrivals, ${trafficCache.departures.length} departures`
    );

    return trafficCache;
  } catch (error) {
    // ── Error handling (preserves existing cache) ──────────────────────────
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;
      console.error(`[trafficService] AviationStack error status: ${status}`);
      console.error('[trafficService] AviationStack error data:', JSON.stringify(data));

      const apiErr = data?.error;
      let errMessage = apiErr?.message || error.message;
      let errCode = apiErr?.code || error.code;
      let statusToSend = status;

      if (apiErr) {
        if (apiErr.code === 'invalid_access_key' || apiErr.code === 'missing_access_key') {
          statusToSend = 401;
        } else if (apiErr.code === 'usage_limit_reached' || apiErr.code === 'monthly_limit_reached') {
          statusToSend = 429;
        }
      }

      const finalError = new Error(errMessage);
      finalError.code = errCode;
      finalError.status = statusToSend;
      throw finalError;
    } else if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      console.error('[trafficService] AviationStack request timeout error detected.');
      const finalError = new Error('Request to AviationStack API timed out');
      finalError.code = 'TIMEOUT';
      finalError.status = 504;
      throw finalError;
    } else {
      console.error('[trafficService] General error fetching traffic:', error.message);
      throw error;
    }
  }
};
