import { pool } from '../config/db.js';

/**
 * Saves a snapshot of live flights to PostgreSQL asynchronously.
 * We do not await this function in the controller to prevent slowing down the frontend API response.
 */
export const saveFlightSnapshot = async (flights) => {
  if (!flights || flights.length === 0) return;

  const client = await pool.connect();
  try {
    // Start a transaction for bulk insert efficiency
    await client.query('BEGIN');
    
    // We use a prepared statement to insert each flight securely
    const insertQuery = `
      INSERT INTO flight_snapshots 
      (icao24, callsign, lat, lon, altitude, speed, heading, aircraft)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `;

    // Process only the first 50 flights to avoid excessive storage growth early on
    const flightsToSave = flights.slice(0, 50);

    for (const flight of flightsToSave) {
      await client.query(insertQuery, [
        flight.hex,               // icao24
        flight.flight?.trim(),    // callsign
        flight.lat,
        flight.lon,
        flight.alt_geom || flight.alt_baro ? Math.round(flight.alt_geom || flight.alt_baro) : null, // altitude
        flight.gs ? Math.round(flight.gs) : null,                // speed
        flight.track ? Math.round(flight.track) : null,             // heading
        flight.t                  // aircraft type
      ]);
    }

    await client.query('COMMIT');
    console.log(`[Database] Saved snapshot of ${flightsToSave.length} flights`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[Database] Failed to save flight snapshot:', error.message);
  } finally {
    client.release();
  }
};
