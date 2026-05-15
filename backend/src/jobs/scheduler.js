import cron from 'node-cron';
import { runFlightCollection } from './flightCollector.js';
import { runRetentionCleanup } from './retentionCleaner.js';

// ─────────────────────────────────────────────────────────────────────────────
// Scheduler Registry
//
// This module is the single point of control for all background jobs.
// Adding or removing a job only requires changes here — not in server.js.
//
// Each job entry documents:
//   - name:     human-readable identifier for logs
//   - schedule: cron expression
//   - handler:  the async function to call
//   - runOnStart: whether to fire once immediately at server boot
//                 (useful so you don't wait 2 min for first data)
// ─────────────────────────────────────────────────────────────────────────────
const JOBS = [
  {
    name: 'Flight Snapshot Collector',
    schedule: '*/2 * * * *', // Every 2 minutes
    //         └─┴──────────  "every 2nd minute" — the */2 means "every N"
    handler: runFlightCollection,
    runOnStart: true,  // Collect immediately so analytics data is ready right away
  },
  {
    name: 'Data Retention Cleaner',
    schedule: '0 2 * * *', // Every day at 2:00 AM UTC
    //         │ └──────── hour 2 (2am), day/month/weekday = * (every)
    //         └────────── minute 0 = top of the hour
    handler: runRetentionCleanup,
    runOnStart: false, // No need to run cleanup immediately on startup
  },
];

/**
 * Starts all registered background jobs.
 *
 * Called once from server.js after Express is listening.
 * The scheduler and the HTTP server then coexist inside the same event loop.
 *
 * NODE-CRON OPTION: { timezone: 'UTC' }
 * We anchor all cron schedules to UTC to avoid issues with daylight saving
 * time (DST) transitions on the host machine. The 2 AM retention job will
 * always run at 2:00 AM UTC, regardless of where the server is hosted.
 */
export const startScheduler = () => {
  console.log('[scheduler] Starting background job scheduler...');

  for (const job of JOBS) {
    // Validate the cron expression before registering. node-cron will throw
    // synchronously if the expression is malformed — catching it here prevents
    // a bad config from crashing the entire server on startup.
    if (!cron.validate(job.schedule)) {
      console.error(`[scheduler] ❌ Invalid cron expression for "${job.name}": "${job.schedule}"`);
      continue;
    }

    // Register the scheduled task
    cron.schedule(job.schedule, job.handler, { timezone: 'UTC' });
    console.log(`[scheduler] ✅ Registered "${job.name}" → schedule: "${job.schedule}"`);

    // Fire immediately on startup if configured
    if (job.runOnStart) {
      console.log(`[scheduler] 🚀 Running "${job.name}" immediately on startup...`);
      job.handler().catch(err => {
        // Swallow startup errors — the cron loop will retry on the next tick
        console.error(`[scheduler] ❌ Startup run of "${job.name}" failed:`, err.message);
      });
    }
  }

  console.log(`[scheduler] ✅ All ${JOBS.length} jobs registered. Telemetry collection is now autonomous.`);
};
