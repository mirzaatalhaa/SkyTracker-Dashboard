import { pool } from '../config/db.js';

// ─────────────────────────────────────────────────────────────────────────────
// Retention Configuration
//
// RETENTION_DAYS controls how much historical data we keep.
// At 2-minute collection intervals (~50 rows per run):
//
//   Rows/day   ≈ 50 × 30 runs/hr × 24 hr = 36,000 rows/day
//   7-day cap  ≈ 252,000 rows — manageable for a single unpartitioned table
//   14-day cap ≈ 504,000 rows — still fine, queries start to slow without tuning
//   30-day cap ≈ 1,080,000 rows — index scans become critical at this scale
//
// Keeping 7 days strikes the right balance between analytics value and DB health
// for a dev-tier single-node PostgreSQL instance.
// ─────────────────────────────────────────────────────────────────────────────
const RETENTION_DAYS = 7;

/**
 * Deletes flight_snapshots older than RETENTION_DAYS.
 *
 * Uses a single DELETE with a WHERE clause, which PostgreSQL executes efficiently
 * using our existing idx_flight_snapshots_time index on the captured_at column.
 *
 * Why not TRUNCATE? TRUNCATE deletes everything. DELETE with WHERE only removes
 * expired rows, preserving recent analytics data.
 *
 * Why not partitioning? Partition-based expiry (DROP PARTITION) is more
 * efficient at scale but requires schema changes and is overkill for Phase 4.
 * This simple DELETE strategy is correct and maintainable now.
 */
export const runRetentionCleanup = async () => {
  const cleanupStart = Date.now();
  console.log(`[retentionCleaner] 🗑️  Starting cleanup — deleting snapshots older than ${RETENTION_DAYS} days...`);

  try {
    const result = await pool.query(
      `DELETE FROM flight_snapshots WHERE captured_at < NOW() - INTERVAL '${RETENTION_DAYS} days'`
    );

    const duration = Date.now() - cleanupStart;
    const deletedRows = result.rowCount;

    if (deletedRows === 0) {
      console.log(`[retentionCleaner] ✅ No expired rows found. Cleanup took ${duration}ms`);
    } else {
      console.log(`[retentionCleaner] ✅ Deleted ${deletedRows} rows. Cleanup took ${duration}ms`);
    }
  } catch (error) {
    const duration = Date.now() - cleanupStart;
    console.error(`[retentionCleaner] ❌ Cleanup failed after ${duration}ms:`, error.message);
    // We do not re-throw — a failed cleanup should not crash the server.
    // The next scheduled run will attempt again.
  }
};
