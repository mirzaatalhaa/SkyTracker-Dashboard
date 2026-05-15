import { pool } from '../config/db.js';

/**
 * Saves daily traffic aggregates (arrivals/departures count).
 * Runs asynchronously after the AviationStack API responds.
 */
export const saveTrafficHistory = async (airport, arrivalsCount, departuresCount) => {
  if (arrivalsCount === 0 && departuresCount === 0) return;

  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

  try {
    // We use ON CONFLICT to update the row if we query multiple times in the same day
    const query = `
      INSERT INTO traffic_history (airport, date, arrivals, departures)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (airport, date) 
      DO UPDATE SET 
        arrivals = EXCLUDED.arrivals,
        departures = EXCLUDED.departures,
        captured_at = NOW()
    `;

    await pool.query(query, [airport, today, arrivalsCount, departuresCount]);
    console.log(`[Database] Updated traffic history for ${airport} on ${today} (${arrivalsCount} arr / ${departuresCount} dep)`);
  } catch (error) {
    console.error('[Database] Failed to save traffic history:', error.message);
  }
};
