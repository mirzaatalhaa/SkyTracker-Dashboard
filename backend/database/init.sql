-- SkyTracker Database Schema (Phase 3)

-- 1. Core Analytics: Flight Snapshots
CREATE TABLE IF NOT EXISTS flight_snapshots (
  id BIGSERIAL PRIMARY KEY,
  icao24 VARCHAR(10) NOT NULL,
  callsign VARCHAR(10),
  lat DECIMAL(9,6),
  lon DECIMAL(9,6),
  altitude INT,
  speed INT,
  heading SMALLINT,
  aircraft VARCHAR(10),
  captured_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index to quickly look up a specific aircraft's history
CREATE INDEX idx_flight_snapshots_icao24 ON flight_snapshots(icao24);
-- Index to quickly query recent flights by time
CREATE INDEX idx_flight_snapshots_time ON flight_snapshots(captured_at);

-- 2. Aggregation: Traffic History
CREATE TABLE IF NOT EXISTS traffic_history (
  id BIGSERIAL PRIMARY KEY,
  airport VARCHAR(5) NOT NULL,
  date DATE NOT NULL,
  arrivals INT DEFAULT 0,
  departures INT DEFAULT 0,
  captured_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(airport, date)
);

-- 3. Lookup: Airlines
CREATE TABLE IF NOT EXISTS airlines (
  iata_code VARCHAR(5) PRIMARY KEY,
  name VARCHAR(100),
  country VARCHAR(50)
);
