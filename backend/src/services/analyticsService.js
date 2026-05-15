import { pool } from '../config/db.js';

/**
 * Retrieves the most recent flight snapshots.
 */
export const getRecentFlightsData = async (limit = 50) => {
  const result = await pool.query(
    'SELECT * FROM flight_snapshots ORDER BY captured_at DESC LIMIT $1',
    [limit]
  );
  return result.rows;
};

/**
 * Retrieves the total count of flight snapshots stored.
 */
export const getFlightCountData = async () => {
  const result = await pool.query('SELECT COUNT(*) as total FROM flight_snapshots');
  return parseInt(result.rows[0].total, 10);
};

/**
 * Retrieves analytics on aircraft types.
 */
export const getAircraftTypeAnalyticsData = async () => {
  const result = await pool.query(`
    SELECT aircraft, COUNT(*) as count 
    FROM flight_snapshots 
    WHERE aircraft IS NOT NULL AND aircraft != ''
    GROUP BY aircraft 
    ORDER BY count DESC 
    LIMIT 10
  `);
  return result.rows;
};

/**
 * Retrieves traffic history for a given airport.
 */
export const getTrafficHistoryData = async (airport = 'COK', limit = 30) => {
  const result = await pool.query(
    'SELECT * FROM traffic_history WHERE airport = $1 ORDER BY date DESC LIMIT $2',
    [airport, limit]
  );
  return result.rows;
};
