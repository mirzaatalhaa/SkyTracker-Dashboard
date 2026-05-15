import { fetchLiveFlights } from '../services/flightService.js';
import { saveFlightSnapshot } from '../services/snapshotService.js';


export const getFlights = async (req, res, next) => {
  try {
    const { lat, lon, radius } = req.query;
    
    // For Phase 1, we just validate simple presence. 
    // Later we can add middleware like Zod or Joi for strict validation.
    if (!lat || !lon || !radius) {
      const error = new Error('Missing required query parameters: lat, lon, radius');
      error.status = 400;
      throw error;
    }

    const data = await fetchLiveFlights(lat, lon, radius);

    // Passive Collection: Save snapshot to PostgreSQL asynchronously
    // Notice we do NOT use 'await' here, so it doesn't slow down the response to the user.
    if (data && data.ac) {
      saveFlightSnapshot(data.ac).catch(e => console.error(e));
    }

    res.status(200).json({
      status: 'success',
      data: data,
      meta: {
        count: data.ac?.length || 0,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    next(error); // Pass to centralized error handler
  }
};
