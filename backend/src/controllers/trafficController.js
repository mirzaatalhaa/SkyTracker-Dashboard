import { fetchKochiTraffic } from '../services/trafficService.js';
import { saveTrafficHistory } from '../services/historyService.js';


export const getTraffic = async (req, res, next) => {
  try {
    const data = await fetchKochiTraffic();

    // Passive Collection: Save daily totals to PostgreSQL asynchronously
    const arrivalsCount = data.arrivals?.length || 0;
    const departuresCount = data.departures?.length || 0;
    saveTrafficHistory('COK', arrivalsCount, departuresCount).catch(e => console.error(e));

    res.status(200).json({
      status: 'success',
      data: data,
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    next(error);
  }
};
