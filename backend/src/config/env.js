import dotenv from 'dotenv';
dotenv.config();

// Default values where applicable, throw errors if critical ones are missing
export const config = {
  port: process.env.PORT || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
  aviationStackKey: process.env.AVIATIONSTACK_KEY || '',
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/skytracker',
};

export const validateEnv = () => {
  // We can add validation here for future required keys (e.g. database URLs)
  if (!config.aviationStackKey) {
    console.warn('[env] WARNING: AVIATIONSTACK_KEY is not set. Traffic proxy may fail.');
  }
};
