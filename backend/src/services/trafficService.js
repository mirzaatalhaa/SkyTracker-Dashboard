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

  try {
    // Fetch arrivals and departures in parallel
    const [arrRes, depRes] = await Promise.all([
      axios.get(`http://api.aviationstack.com/v1/flights?access_key=${apiKey}&arr_iata=${COK_IATA}&limit=100`),
      axios.get(`http://api.aviationstack.com/v1/flights?access_key=${apiKey}&dep_iata=${COK_IATA}&limit=100`)
    ]);

    const arrData = arrRes.data;
    const depData = depRes.data;

    if (arrData.error || depData.error) {
      throw new Error(arrData.error?.message || depData.error?.message || 'AviationStack API returned an error');
    }

    return {
      arrivals: arrData.data || [],
      departures: depData.data || [],
    };
  } catch (error) {
    console.error('[trafficService] Error fetching COK traffic:', error.message);
    const customError = new Error('Failed to fetch airport traffic data');
    customError.status = 502;
    throw customError;
  }
};
