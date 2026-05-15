import { useState, useEffect } from 'react';

// Kochi airport coordinates
const LAT = 10.1520;
const LNG = 76.3930;

const WEATHER_CODES = {
  0: { label: 'Clear', icon: 'clear_day' },
  1: { label: 'Mostly Clear', icon: 'clear_day' },
  2: { label: 'Partly Cloudy', icon: 'partly_cloudy_day' },
  3: { label: 'Overcast', icon: 'cloud' },
  45: { label: 'Fog', icon: 'foggy' },
  48: { label: 'Rime Fog', icon: 'foggy' },
  51: { label: 'Light Drizzle', icon: 'rainy' },
  53: { label: 'Drizzle', icon: 'rainy' },
  55: { label: 'Heavy Drizzle', icon: 'rainy' },
  61: { label: 'Light Rain', icon: 'rainy' },
  63: { label: 'Rain', icon: 'rainy' },
  65: { label: 'Heavy Rain', icon: 'rainy' },
  71: { label: 'Light Snow', icon: 'weather_snowy' },
  73: { label: 'Snow', icon: 'weather_snowy' },
  75: { label: 'Heavy Snow', icon: 'weather_snowy' },
  80: { label: 'Showers', icon: 'rainy' },
  81: { label: 'Mod. Showers', icon: 'rainy' },
  82: { label: 'Heavy Showers', icon: 'rainy' },
  95: { label: 'Thunderstorm', icon: 'thunderstorm' },
  96: { label: 'T-Storm + Hail', icon: 'thunderstorm' },
  99: { label: 'T-Storm + Hail', icon: 'thunderstorm' },
};

export const useWeather = () => {
  const [weather, setWeather] = useState(null);

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const url = `/api/v1/weather/cok`;
        const res = await fetch(url);
        if (res.ok) {
          const json = await res.json();
          // The backend passes through the open-meteo response under data
          const c = json.data.current;
          const code = WEATHER_CODES[c.weather_code] || { label: 'Unknown', icon: 'help' };
          setWeather({
            temp: Math.round(c.temperature_2m),
            feelsLike: Math.round(c.apparent_temperature),
            humidity: c.relative_humidity_2m,
            windSpeed: Math.round(c.wind_speed_10m),
            windDir: Math.round(c.wind_direction_10m),
            visibility: c.visibility ? (c.visibility / 1000).toFixed(1) : null,
            condition: code.label,
            icon: code.icon,
          });
        }
      } catch (err) {
        console.error('[Frontend] Weather fetch failed:', err);
      }
    };


    fetchWeather();
    // Refresh every 10 minutes
    const interval = setInterval(fetchWeather, 600000);
    return () => clearInterval(interval);
  }, []);

  return weather;
};
