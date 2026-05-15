import axios from 'axios';

/**
 * Fetches current weather for Kochi (COK) from Open-Meteo.
 */
export const fetchKochiWeather = async () => {
  const LAT = 10.1520;
  const LNG = 76.3930;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LNG}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,weather_code,apparent_temperature,visibility&wind_speed_unit=kn&timezone=Asia/Kolkata`;

  try {
    const response = await axios.get(url, { timeout: 5000 });
    return response.data;
  } catch (error) {
    console.error('[weatherService] Error fetching weather:', error.message);
    const customError = new Error('Failed to fetch weather data');
    customError.status = 502;
    throw customError;
  }
};
