import axios from 'axios';
import { config } from '../config/env.js';

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

// 30-minute in-memory cache configuration
let trafficCache = null;
let cacheTime = null;
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

/**
 * Fetches Arrivals and Departures for COK using AviationStack.
 */
export const fetchKochiTraffic = async () => {
  const apiKey = config.aviationStackKey;
  const COK_IATA = 'COK';

  if (!apiKey) {
    const error = new Error('AviationStack API Key is not configured on the server.');
    error.status = 500;
    throw error;
  }

  // Check cache validity
  const now = Date.now();
  if (trafficCache && cacheTime && (now - cacheTime < CACHE_DURATION)) {
    console.log(`[trafficService] Cache hit: Returning cached traffic data. Age: ${Math.round((now - cacheTime) / 1000)}s`);
    return trafficCache;
  }

  try {
    console.log('[trafficService] Cache miss: Fetching fresh COK traffic data from AviationStack (HTTPS)...');
    
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
      if (err.code === 'invalid_access_key' || err.code === 'missing_access_key') {
        console.error('[trafficService] Invalid API key error detected.');
      } else if (err.code === 'usage_limit_reached' || err.code === 'monthly_limit_reached') {
        console.error('[trafficService] API quota exceeded error detected.');
      }
      const customError = new Error(err.message || 'AviationStack API returned an error');
      customError.code = err.code;
      customError.status = err.code === 'invalid_access_key' ? 401 : (err.code === 'usage_limit_reached' ? 429 : 400);
      throw customError;
    }

    if (depData.error) {
      const err = depData.error;
      console.error(`[trafficService] AviationStack API Error (Departures): Code=${err.code}, Message=${err.message}`);
      if (err.code === 'invalid_access_key' || err.code === 'missing_access_key') {
        console.error('[trafficService] Invalid API key error detected.');
      } else if (err.code === 'usage_limit_reached' || err.code === 'monthly_limit_reached') {
        console.error('[trafficService] API quota exceeded error detected.');
      }
      const customError = new Error(err.message || 'AviationStack API returned an error');
      customError.code = err.code;
      customError.status = err.code === 'invalid_access_key' ? 401 : (err.code === 'usage_limit_reached' ? 429 : 400);
      throw customError;
    }

    const trafficData = {
      arrivals: arrData.data || [],
      departures: depData.data || [],
    };

    // Cache the successful results
    trafficCache = trafficData;
    cacheTime = Date.now();
    console.log('[trafficService] Successfully updated traffic cache with fresh data.');

    return trafficData;
  } catch (error) {
    // Process Axios level or programmatically thrown errors without hiding real details
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
          console.error('[trafficService] Invalid API key error detected.');
          statusToSend = 401;
        } else if (apiErr.code === 'usage_limit_reached' || apiErr.code === 'monthly_limit_reached') {
          console.error('[trafficService] API quota exceeded error detected.');
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
