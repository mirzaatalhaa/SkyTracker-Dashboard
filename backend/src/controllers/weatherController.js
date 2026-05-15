import { fetchKochiWeather } from '../services/weatherService.js';

export const getWeather = async (req, res, next) => {
  try {
    const data = await fetchKochiWeather();

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
