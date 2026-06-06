# ✈️ SkyTracker Dashboard

A real-time flight tracking and airport analytics dashboard focused on **Cochin International Airport (COK)** and its surrounding airspace. SkyTracker displays live aircraft on an interactive map, tracks COK arrivals and departures, shows local weather conditions, and builds historical analytics from continuously collected flight data.

---

## 📸 Preview

> A full-screen interactive map centered on Kochi, Kerala, with live aircraft markers, a weather widget, a COK traffic panel, and an analytics dashboard.

---

## 🚀 Features

- **Live Flight Map** — Displays real-time aircraft within a 250 km radius of COK using the [airplanes.live](https://airplanes.live) API, rendered on a Leaflet map with up to 300 aircraft markers
- **COK Traffic Panel** — Shows today's arrivals and departures at Cochin International Airport via the AviationStack API, including recent flight listings with origin/destination and timestamps
- **Weather Widget** — Current Kochi weather (temperature, humidity, wind speed & direction, visibility) fetched from [Open-Meteo](https://open-meteo.com)
- **Analytics Dashboard** — Charts and tables built from historical data: flight counts, aircraft type breakdown, traffic history, and a recent flights table
- **Autonomous Data Collection** — A background scheduler snapshots live flight data to PostgreSQL every 2 minutes, with a daily cleanup job to manage data retention
- **Airport Layer** — Airport markers rendered on the map from local GeoJSON data
- **Mobile Responsive** — Collapsible sidebar panels and adaptive layout for small screens

---

## 🏗️ Architecture

```
SkyTracker-Dashboard/
├── frontend/           # React + Vite + Tailwind CSS
│   └── src/
│       ├── App.jsx                   # Main app, map, layout
│       ├── components/
│       │   ├── FlightMarker.jsx      # Individual aircraft marker
│       │   ├── AirportLayer.jsx      # Airport icons on map
│       │   ├── KochiTrafficPanel.jsx # Arrivals/departures panel
│       │   └── analytics/            # Charts and analytics views
│       ├── hooks/
│       │   ├── useOpenSky.js         # Live flight data hook
│       │   ├── useWeather.js         # Weather data hook
│       │   ├── useKochiTraffic.js    # Airport traffic hook
│       │   └── useAnalytics.js       # Analytics data hook
│       └── data/
│           └── airportData.json      # Static airport GeoJSON
│
├── backend/            # Node.js + Express + PostgreSQL
│   └── src/
│       ├── controllers/              # Route handlers
│       ├── services/                 # External API integrations
│       ├── jobs/
│       │   ├── scheduler.js          # Cron job registry
│       │   ├── flightCollector.js    # Periodic flight snapshot job
│       │   └── retentionCleaner.js   # Daily DB cleanup job
│       ├── routes/api.js             # API route definitions
│       ├── config/
│       │   ├── db.js                 # PostgreSQL connection pool
│       │   └── env.js                # Environment config & validation
│       └── database/
│           ├── init.sql              # Schema creation
│           └── seed.sql              # Seed data
│
└── docker-compose.yml  # Orchestrates postgres, backend, frontend
```

---

## 🛠️ Tech Stack

| Layer      | Technology                                      |
|------------|-------------------------------------------------|
| Frontend   | React 19, Vite, Tailwind CSS, Leaflet / React-Leaflet, Recharts |
| Backend    | Node.js, Express 5, node-cron                   |
| Database   | PostgreSQL 15                                   |
| APIs       | airplanes.live (free, no key), Open-Meteo (free, no key), AviationStack (key required) |
| Deployment | Docker + Docker Compose                         |

---

## ⚙️ Getting Started

### Prerequisites

- [Docker](https://www.docker.com/) and Docker Compose
- An [AviationStack](https://aviationstack.com) API key (free tier available) — required for the COK traffic panel

### 1. Clone the repository

```bash
git clone https://github.com/mirzaatalhaa/SkyTracker-Dashboard.git
cd SkyTracker-Dashboard
```

### 2. Configure environment variables

Create a `.env` file in the project root:

```env
AVIATIONSTACK_KEY=your_api_key_here
```

> Without this key, the COK traffic panel will show an error but the rest of the dashboard (live map, weather, analytics) will still work.

### 3. Start with Docker Compose

```bash
docker-compose up --build
```

This starts three services:

| Service    | URL                    |
|------------|------------------------|
| Frontend   | http://localhost        |
| Backend API| http://localhost:3001/api/v1 |
| PostgreSQL | localhost:5432          |

### 4. Local development (without Docker)

**Backend:**
```bash
cd backend
npm install
cp .env.example .env   # set DATABASE_URL and AVIATIONSTACK_KEY
npm run dev
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev            # runs at http://localhost:5173
```

---

## 📡 API Endpoints

| Method | Endpoint                               | Description                        |
|--------|----------------------------------------|------------------------------------|
| GET    | `/api/v1/health`                       | Health check                       |
| GET    | `/api/v1/flights`                      | Live flights near COK              |
| GET    | `/api/v1/traffic/cok`                  | COK arrivals & departures          |
| GET    | `/api/v1/weather/cok`                  | Current Kochi weather              |
| GET    | `/api/v1/analytics/flights/recent`     | Recent flight snapshots            |
| GET    | `/api/v1/analytics/flights/count`      | Total flights recorded             |
| GET    | `/api/v1/analytics/flights/aircraft-types` | Aircraft type breakdown        |
| GET    | `/api/v1/analytics/traffic/history`    | Historical traffic per airport     |

---

## 🗄️ Database Schema

**`flight_snapshots`** — Raw aircraft telemetry captured every 2 minutes
- `icao24`, `callsign`, `lat`, `lon`, `altitude`, `speed`, `heading`, `aircraft`, `captured_at`

**`traffic_history`** — Daily aggregated arrivals/departures per airport
- `airport`, `date`, `arrivals`, `departures`

**`airlines`** — Airline lookup table (IATA code, name, country)

---

## ⏱️ Background Jobs

| Job                     | Schedule             | Description                                      |
|-------------------------|----------------------|--------------------------------------------------|
| Flight Snapshot Collector | Every 2 minutes    | Fetches live aircraft near COK and saves to DB  |
| Data Retention Cleaner  | Daily at 2:00 AM UTC | Removes old snapshots to keep the DB lean        |

---

## 🌍 External APIs

| API              | Usage                         | Key Required |
|------------------|-------------------------------|--------------|
| airplanes.live   | Live aircraft positions        | No           |
| Open-Meteo       | Current weather data          | No           |
| AviationStack    | Airport arrivals & departures | Yes (free tier available) |

---

## 📦 Environment Variables

| Variable          | Default                                           | Description                  |
|-------------------|---------------------------------------------------|------------------------------|
| `PORT`            | `3001`                                            | Backend server port          |
| `NODE_ENV`        | `development`                                     | Environment mode             |
| `DATABASE_URL`    | `postgresql://postgres:password@localhost:5432/skytracker` | PostgreSQL connection string |
| `AVIATIONSTACK_KEY` | _(empty)_                                       | AviationStack API key        |

---

## 🚀 CI/CD Pipeline

SkyTracker uses **GitHub Actions** for continuous deployment to an **AWS EC2** instance. Every push to the `master` branch automatically deploys the latest version to production — no manual SSH or deployment commands required.

### How It Works

1. Code is pushed to the `master` branch on GitHub
2. GitHub Actions triggers the deployment workflow (`.github/workflows/deploy.yml`)
3. The workflow SSHs into the EC2 instance using stored secrets
4. It pulls the latest code and rebuilds/restarts all Docker containers via Docker Compose

### Workflow File

```yaml
# .github/workflows/deploy.yml
name: Deploy to EC2

on:
  push:
    branches:
      - master

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.EC2_HOST }}
          username: ${{ secrets.EC2_USERNAME }}
          key: ${{ secrets.EC2_SSH_KEY }}
          script: |
            cd ~/SkyTracker-Dashboard
            git pull origin master
            docker-compose up --build -d
```

### GitHub Secrets Required

| Secret | Description |
|--------|-------------|
| `EC2_HOST` | Public IP address of the EC2 instance |
| `EC2_USERNAME` | SSH username (e.g., `ubuntu` or `ec2-user`) |
| `EC2_SSH_KEY` | Private SSH key for authenticating with the EC2 instance |

### Setup Steps

1. **Generate an SSH key pair** on the EC2 instance (or locally) and add the public key to `~/.ssh/authorized_keys` on the server
2. **Add the three secrets** above to your GitHub repository under *Settings → Secrets and variables → Actions*
3. **Open port 22** in the EC2 instance's AWS Security Group to allow inbound SSH from GitHub Actions runners
4. **Push to `master`** — the workflow triggers automatically and deploys within seconds

> **Note:** Ensure the EC2 instance's local repository is in sync with GitHub before enabling the pipeline (resolve any uncommitted local changes via `git stash` or `git reset`).

---



*Built with ❤️ and focused on Cochin International Airport (COK), Kerala, India.*
