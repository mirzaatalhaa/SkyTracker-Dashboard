# ✈️ SkyTracker Dashboard

A real-time flight tracking and airport analytics dashboard focused on **Cochin International Airport (COK)** and its surrounding airspace. SkyTracker displays live aircraft on an interactive map, tracks COK arrivals and departures, shows local weather conditions, and builds historical analytics from continuously collected flight data.

🌐 Live: sky-track.app

---

## 📸 Preview

| Live Map & Air Traffic Panel | Aircraft Type Distribution |
|:---:|:---:|
| ![SkyTracker live map with weather panel and COK traffic](screenshot-main.png) | ![Fleet analytics bar chart of aircraft types by snapshot frequency](screenshot-flight-detail.png) |

| Analytics Overview | Flight Detail Popup |
|:---:|:---:|
| ![Analytics dashboard showing 64,115 snapshots, 10 aircraft types](screenshot-analytics.png) | ![Flight detail popup showing AXB2382 B38M Air India Express](screenshot-fleet.png) |

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

## 📊 Monitoring & Alerting

SkyTracker includes a production-grade monitoring and alerting stack built on **AWS CloudWatch** and **Amazon SNS**, providing full infrastructure visibility and automated operational alerts.

### Overview

| Component | Tool | Purpose |
|-----------|------|---------|
| Metrics collection | CloudWatch Agent | CPU, memory, disk, disk I/O |
| Log aggregation | CloudWatch Logs | `/var/log/syslog` from EC2 |
| Alarms | CloudWatch Alarms | Threshold-based alerting |
| Notifications | Amazon SNS + Email | Instant alert delivery |

### Architecture

```
EC2 Instance (SkyTracker)
 ├── CloudWatch Agent
 │    ├── System Metrics → CloudWatch namespace: CWAgent
 │    │    ├── mem_used_percent
 │    │    ├── cpu_usage_active
 │    │    ├── disk_used_percent
 │    │    └── disk_io_read/write
 │    └── Log Files → CloudWatch Log Groups
 │         └── /var/log/syslog
 └── IAM Role: CloudWatchAgentServerPolicy
          ↓
 CloudWatch Alarms
 ├── High Memory (>80%)  ─┐
 ├── High CPU (>70%)     ─┼─→ SNS Topic → Email Subscription
 └── High Disk (>80%)   ─┘
```

### Setup Instructions

#### 1. Create SNS Topic & Email Subscription

```bash
# Create the SNS topic
aws sns create-topic --name skytracker-alerts

# Subscribe your email (replace with your address)
aws sns subscribe \
  --topic-arn arn:aws:sns:<region>:<account-id>:skytracker-alerts \
  --protocol email \
  --notification-endpoint your@email.com
```

> Confirm the subscription via the email AWS sends you.

#### 2. Attach IAM Role to EC2

Create and attach an IAM role with the `CloudWatchAgentServerPolicy` managed policy to your EC2 instance:

```bash
# Create the role
aws iam create-role \
  --role-name CloudWatchAgentRole \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": { "Service": "ec2.amazonaws.com" },
      "Action": "sts:AssumeRole"
    }]
  }'

# Attach the managed policy
aws iam attach-role-policy \
  --role-name CloudWatchAgentRole \
  --policy-arn arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy

# Create instance profile and attach role
aws iam create-instance-profile --instance-profile-name CloudWatchAgentProfile
aws iam add-role-to-instance-profile \
  --instance-profile-name CloudWatchAgentProfile \
  --role-name CloudWatchAgentRole

# Attach profile to your EC2 instance
aws ec2 associate-iam-instance-profile \
  --instance-id <your-instance-id> \
  --iam-instance-profile Name=CloudWatchAgentProfile
```

#### 3. Install & Configure CloudWatch Agent

SSH into your EC2 instance:

```bash
# Install the agent
wget https://s3.amazonaws.com/amazoncloudwatch-agent/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb
sudo dpkg -i -E ./amazon-cloudwatch-agent.deb

# Write the agent config
sudo tee /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json > /dev/null <<'EOF'
{
  "agent": {
    "metrics_collection_interval": 60,
    "run_as_user": "cwagent"
  },
  "metrics": {
    "namespace": "CWAgent",
    "metrics_collected": {
      "mem":  { "measurement": ["mem_used_percent"] },
      "disk": { "measurement": ["disk_used_percent", "disk_io_read", "disk_io_write"],
                "resources": ["/"] },
      "cpu":  { "measurement": ["cpu_usage_active"],
                "totalcpu": true }
    }
  },
  "logs": {
    "logs_collected": {
      "files": {
        "collect_list": [{
          "file_path": "/var/log/syslog",
          "log_group_name": "/skytracker/ec2/syslog",
          "log_stream_name": "{instance_id}"
        }]
      }
    }
  }
}
EOF

# Start the agent
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
  -a fetch-config -m ec2 \
  -c file:/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json \
  -s

# Verify it's running
sudo systemctl status amazon-cloudwatch-agent
```

#### 4. Create CloudWatch Alarms

Replace `<REGION>`, `<ACCOUNT_ID>`, and `<INSTANCE_ID>` with your values:

```bash
SNS_ARN="arn:aws:sns:<REGION>:<ACCOUNT_ID>:skytracker-alerts"
INSTANCE="<INSTANCE_ID>"

# High memory alarm (>80%)
aws cloudwatch put-metric-alarm \
  --alarm-name "SkyTracker-HighMemory" \
  --alarm-description "Memory usage exceeded 80%" \
  --metric-name mem_used_percent \
  --namespace CWAgent \
  --dimensions Name=InstanceId,Value=$INSTANCE \
  --statistic Average \
  --period 300 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2 \
  --alarm-actions $SNS_ARN

# High CPU alarm (>70%)
aws cloudwatch put-metric-alarm \
  --alarm-name "SkyTracker-HighCPU" \
  --alarm-description "CPU utilization exceeded 70%" \
  --metric-name cpu_usage_active \
  --namespace CWAgent \
  --dimensions Name=InstanceId,Value=$INSTANCE \
  --statistic Average \
  --period 300 \
  --threshold 70 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2 \
  --alarm-actions $SNS_ARN

# High disk alarm (>80%)
aws cloudwatch put-metric-alarm \
  --alarm-name "SkyTracker-HighDisk" \
  --alarm-description "Disk usage exceeded 80%" \
  --metric-name disk_used_percent \
  --namespace CWAgent \
  --dimensions Name=InstanceId,Value=$INSTANCE Name=path,Value=/ \
  --statistic Average \
  --period 300 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2 \
  --alarm-actions $SNS_ARN
```

### Active Alarms

| Alarm | Metric | Threshold | Period | Action |
|-------|--------|-----------|--------|--------|
| SkyTracker-HighMemory | `mem_used_percent` | > 80% | 5 min × 2 | SNS Email |
| SkyTracker-HighCPU | `cpu_usage_active` | > 70% | 5 min × 2 | SNS Email |
| SkyTracker-HighDisk | `disk_used_percent` | > 80% | 5 min × 2 | SNS Email |

### Verifying Metrics

After setup, confirm metrics appear in CloudWatch:

```bash
aws cloudwatch list-metrics --namespace CWAgent
```

You should see `mem_used_percent`, `cpu_usage_active`, and `disk_used_percent` listed under `CWAgent`.

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
