import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { config, validateEnv } from './src/config/env.js';
import apiRoutes from './src/routes/api.js';
import { startScheduler } from './src/jobs/scheduler.js';

// Validate environment variables on startup
validateEnv();

const app = express();

// Middleware
app.use(cors()); // Allow all origins for dev, restrict in production later
app.use(express.json());
app.use(morgan('dev')); // HTTP request logging

// Routes
app.use('/api/v1', apiRoutes);

// Centralized error handler
app.use((err, req, res, next) => {
  console.error('[server] Error:', err.stack || err.message);
  
  const statusCode = err.status || 500;
  res.status(statusCode).json({
    status: 'error',
    error: {
      message: err.message || 'Internal Server Error',
    }
  });
});

// Start Server
// We start the scheduler INSIDE the listen callback to guarantee the server is
// fully bound and the database pool is established before the first job fires.
app.listen(config.port, () => {
  console.log(`[server] SkyTracker backend running in ${config.nodeEnv} mode on port ${config.port}`);
  startScheduler();
});

