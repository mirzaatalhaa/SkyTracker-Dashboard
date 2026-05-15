import { 
  getRecentFlightsData, 
  getFlightCountData, 
  getAircraftTypeAnalyticsData, 
  getTrafficHistoryData 
} from '../services/analyticsService.js';

export const getRecentFlights = async (req, res, next) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 50;
    const data = await getRecentFlightsData(limit);
    
    res.status(200).json({
      status: 'success',
      data,
      meta: { count: data.length, timestamp: new Date().toISOString() }
    });
  } catch (error) {
    next(error);
  }
};

export const getFlightCount = async (req, res, next) => {
  try {
    const total = await getFlightCountData();
    
    res.status(200).json({
      status: 'success',
      data: { total },
      meta: { timestamp: new Date().toISOString() }
    });
  } catch (error) {
    next(error);
  }
};

export const getAircraftTypes = async (req, res, next) => {
  try {
    const data = await getAircraftTypeAnalyticsData();
    
    res.status(200).json({
      status: 'success',
      data,
      meta: { count: data.length, timestamp: new Date().toISOString() }
    });
  } catch (error) {
    next(error);
  }
};

export const getTrafficHistory = async (req, res, next) => {
  try {
    const airport = req.query.airport || 'COK';
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 30;
    
    const data = await getTrafficHistoryData(airport, limit);
    
    res.status(200).json({
      status: 'success',
      data,
      meta: { airport, count: data.length, timestamp: new Date().toISOString() }
    });
  } catch (error) {
    next(error);
  }
};
