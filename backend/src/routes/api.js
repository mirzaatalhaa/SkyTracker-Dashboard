import { Router } from 'express';
import { getHealth } from '../controllers/healthController.js';
import { getFlights } from '../controllers/flightController.js';
import { getTraffic } from '../controllers/trafficController.js';
import { getWeather } from '../controllers/weatherController.js';
import { 
  getRecentFlights, 
  getFlightCount, 
  getAircraftTypes, 
  getTrafficHistory 
} from '../controllers/analyticsController.js';

const router = Router();

// Health Check
router.get('/health', getHealth);

// Live Flights (airplanes.live)
router.get('/flights', getFlights);

// COK Traffic (AviationStack)
router.get('/traffic/cok', getTraffic);

// COK Weather (Open-Meteo)
router.get('/weather/cok', getWeather);

// Analytics
router.get('/analytics/flights/recent', getRecentFlights);
router.get('/analytics/flights/count', getFlightCount);
router.get('/analytics/flights/aircraft-types', getAircraftTypes);
router.get('/analytics/traffic/history', getTrafficHistory);

// 404 handler for /api/v1/*
router.use((req, res) => {
  res.status(404).json({ status: 'error', error: { message: 'API Route Not Found' } });
});

export default router;
