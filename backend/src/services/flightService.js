import axios from 'axios';

// Add interceptor to log external API request timing
axios.interceptors.request.use(config => {
  config.metadata = { startTime: new Date() };
  return config;
});

axios.interceptors.response.use(response => {
  const duration = new Date() - response.config.metadata.startTime;
  console.log(`[Backend -> External] GET ${response.config.url} - ${duration}ms`);
  return response;
}, error => {
  if (error.config) {
    const duration = new Date() - error.config.metadata.startTime;
    console.error(`[Backend -> External] ERROR GET ${error.config.url} - ${duration}ms - ${error.message}`);
  }
  return Promise.reject(error);
});

/**
 * Fetches live flights from airplanes.live API.
 * This standardizes the data source to the free, unauthenticated provider
 * as requested in the implementation plan.
 */
export const fetchLiveFlights = async (lat, lon, radius) => {
  try {
    // Airplanes.live radial endpoint format: /v2/point/{lat}/{lon}/{radius}
    const url = `https://api.airplanes.live/v2/point/${lat}/${lon}/${radius}`;
    const response = await axios.get(url, {
      timeout: 5000 // 5 second timeout to prevent hanging requests
    });
    
    return response.data;
  } catch (error) {
    console.error('[flightService] Error fetching flights:', error.message);
    const customError = new Error('Failed to fetch live flight data');
    customError.status = 502; // Bad Gateway
    throw customError;
  }
};
