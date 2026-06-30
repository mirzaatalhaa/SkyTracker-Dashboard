import { getCachedTraffic, refreshTrafficFromApi } from '../services/trafficService.js';
import { saveTrafficHistory } from '../services/historyService.js';

/**
 * GET /api/v1/traffic/cok
 *
 * Returns cached COK traffic data. This endpoint NEVER triggers an
 * AviationStack API call — it only serves whatever the last scheduled
 * or manual refresh fetched.
 */
export const getTraffic = async (req, res, next) => {
  try {
    const data = getCachedTraffic();

    if (!data) {
      return res.status(503).json({
        status: 'error',
        error: {
          message: 'Traffic data is not yet available. The server is waiting for the first scheduled refresh.',
          code: 'CACHE_EMPTY',
        },
      });
    }

    // Passive Collection: Save daily totals to PostgreSQL asynchronously
    const arrivalsCount = data.arrivals?.length || 0;
    const departuresCount = data.departures?.length || 0;
    saveTrafficHistory('COK', arrivalsCount, departuresCount).catch(e => console.error(e));

    res.status(200).json({
      status: 'success',
      data: data,
      meta: {
        timestamp: new Date().toISOString(),
        lastRefreshed: data.lastRefreshed || null,
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/traffic/cok/refresh
 *
 * Admin-only manual refresh endpoint. Triggers a fresh fetch from
 * AviationStack, but ONLY if today's daily call budget is not exhausted.
 * This uses part of the daily 2-call budget — it does NOT add extra calls.
 *
 * NOTE: No auth middleware is applied yet. In production, protect this
 * route with authentication (e.g. API key, JWT, or session check).
 */
export const refreshTraffic = async (req, res, next) => {
  try {
    console.log(`[trafficController] 🔧 Manual refresh triggered from ${req.ip} at ${new Date().toISOString()}`);

    const result = await refreshTrafficFromApi({ source: `manual-refresh (IP: ${req.ip})` });

    if (result.skipped) {
      return res.status(429).json({
        status: 'error',
        error: {
          message: 'Daily API call budget is exhausted. Manual refresh is blocked until midnight.',
          code: 'BUDGET_EXHAUSTED',
        },
      });
    }

    // Passive Collection: Save daily totals to PostgreSQL asynchronously
    const arrivalsCount = result.arrivals?.length || 0;
    const departuresCount = result.departures?.length || 0;
    saveTrafficHistory('COK', arrivalsCount, departuresCount).catch(e => console.error(e));

    res.status(200).json({
      status: 'success',
      data: result,
      meta: {
        timestamp: new Date().toISOString(),
        message: 'Traffic data refreshed successfully from AviationStack.',
      }
    });
  } catch (error) {
    next(error);
  }
};
