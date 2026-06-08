# ☁️ Cloud Deployment — AWS EC2

SkyTracker has been deployed to a live AWS cloud environment, transitioning from a local Docker Compose setup to a production-accessible server on the public internet. This phase covers infrastructure provisioning, container orchestration on a remote Linux host, and the operational workflow for shipping updates to a cloud environment.

---

## 🏛️ Deployment Architecture

```
                        ┌─────────────────────────────────────────────┐
                        │           AWS EC2 — Ubuntu Server           │  
                        │                                             │
   Internet             │   ┌─────────────┐     ┌─────────────────┐   │
   ──────────────────►  │   │  Frontend   │     │    Backend      │   │
   HTTP :80             │   │  (Nginx)    │────►│  (Node/Express) │   │
                        │   │  React SPA  │     │   Port 3001     │   │
                        │   └─────────────┘     └────────┬────────┘   │
                        │                                │            │
                        │                       ┌────────▼────────┐   │
                        │                       │   PostgreSQL    │   │
                        │                       │   Port 5432     │   │
                        │                       │  [Volume Mount] │   │
                        │                       └─────────────────┘   │
                        │                                             │
                        │         Docker Bridge Network               │
                        └─────────────────────────────────────────────┘
```

All three application containers run within a single Docker Compose-managed bridge network on the EC2 instance. Inter-container communication uses Docker's internal DNS (service names as hostnames), keeping database credentials and backend traffic off the public network. Only ports **80** (frontend) and **3001** (API) are exposed to the internet via EC2 Security Group rules.

---

## ☁️ Infrastructure

| Component        | Details                                      |
|------------------|----------------------------------------------|
| Cloud Provider   | Amazon Web Services (AWS)                    |
| Compute          | EC2 — Ubuntu Server 22.04 LTS               |
| Containerization | Docker Engine + Docker Compose               |
| Web Server       | Nginx (inside frontend container)            |
| Database Storage | Docker named volume (`postgres_data`) — persists across container restarts and redeployments |
| Networking       | EC2 Security Group with inbound rules on ports 22 (SSH), 80 (HTTP), 3001 (API) |
| Access           | Public EC2 IPv4 address                      |

---

## 🐳 Container Structure

```yaml
services:
  postgres:       # PostgreSQL 15 — data layer
  backend:        # Node.js/Express API — business logic + cron jobs
  frontend:       # React SPA served via Nginx — user interface
```

**Startup order and health checks** are enforced through Compose's `depends_on` with `condition: service_healthy`. The PostgreSQL container exposes a `pg_isready` health probe; the backend will not start until the database passes this check, preventing connection errors on cold boot.

**Persistent storage** is handled by a named Docker volume (`postgres_data`) mapped to `/var/lib/postgresql/data`. Flight snapshot history and traffic analytics survive container recreation, image rebuilds, and instance reboots.

**Environment variables** are injected at runtime via a `.env` file on the server (never committed to version control). The backend reads `DATABASE_URL`, `AVIATIONSTACK_KEY`, `PORT`, and `NODE_ENV` through `dotenv`, keeping all secrets out of the image layers.

---

## 🚀 Deployment Workflow

### Initial Server Provisioning

```bash
# 1. SSH into the EC2 instance
ssh -i skytracker-key.pem ubuntu@<EC2_PUBLIC_IP>

# 2. Install Docker Engine
sudo apt-get update
sudo apt-get install -y docker.io docker-compose-plugin

# 3. Add ubuntu user to docker group (avoid sudo on every command)
sudo usermod -aG docker ubuntu && newgrp docker
```

### Application Deployment

```bash
# 4. Clone the repository onto the server
git clone https://github.com/mirzaatalhaa/SkyTracker-Dashboard.git
cd SkyTracker-Dashboard

# 5. Configure environment variables
nano .env
# → Set AVIATIONSTACK_KEY, DATABASE_URL, NODE_ENV=production

# 6. Build images and start all containers
docker compose up --build -d

# 7. Verify all containers are healthy
docker compose ps
docker compose logs -f backend
```

### Shipping Updates

```bash
# Pull latest code, rebuild only changed services, zero manual steps
git pull origin main
docker compose up --build -d
```

Docker layer caching ensures unchanged services (e.g. PostgreSQL) are not restarted during a frontend-only update, minimising downtime.

### Operational Commands

```bash
# Tail live logs across all services
docker compose logs -f

# Inspect PostgreSQL data without exposing a port
docker compose exec postgres psql -U postgres -d skytracker

# Graceful shutdown (preserves volumes)
docker compose down

# Full teardown including data volumes (destructive)
docker compose down -v
```

---

## 🔒 Security Configuration

**EC2 Security Group — Inbound Rules**

| Port | Protocol | Source    | Purpose                        |
|------|----------|-----------|--------------------------------|
| 22   | TCP      | My IP     | SSH administration             |
| 80   | TCP      | 0.0.0.0/0 | Public HTTP (frontend)         |
| 3001 | TCP      | 0.0.0.0/0 | Public API access              |
| 5432 | TCP      | *(closed)*| PostgreSQL — internal only     |

PostgreSQL is intentionally **not** exposed via a Security Group rule. Database access is only available from within the Docker bridge network, reachable by the backend service using the internal hostname `postgres`.

SSH access is locked to a specific IP using an `.pem` key pair, following AWS best practices for EC2 instance access.

---

## 🛠️ Technologies Used

| Category              | Technology                          |
|-----------------------|-------------------------------------|
| Cloud Infrastructure  | AWS EC2, Security Groups, Key Pairs |
| Operating System      | Ubuntu Server 22.04 LTS             |
| Containerization      | Docker Engine, Docker Compose       |
| Container Networking  | Docker Bridge Network               |
| Persistent Storage    | Docker Named Volumes                |
| Web Server / Reverse Proxy | Nginx                          |
| Runtime               | Node.js 20, PostgreSQL 15           |
| Deployment Workflow   | SSH, Git, Docker layer caching      |
| Secret Management     | `.env` file, runtime injection      |

---

## 📐 Key Engineering Decisions

**Why Docker Compose on EC2 rather than ECS or Kubernetes?**
For a project at this scale, Compose provides the same multi-container orchestration model as production systems (service dependencies, health checks, named networks, volumes) without the operational overhead of a managed container service. The architecture is deliberately portable — migrating to ECS Fargate or a Kubernetes cluster would require minimal changes to the `docker-compose.yml`.

**Why a named volume instead of a bind mount for PostgreSQL?**
Named volumes are managed entirely by Docker and are immune to host path permission issues, making them the correct choice for stateful services on a remote Linux server where the host directory structure may vary.

**Why Nginx inside the frontend container?**
Serving the React SPA from Nginx eliminates the need for a separate reverse proxy tier at this scale. Nginx handles static asset caching headers, `index.html` fallback routing for client-side navigation, and gzip compression — giving production-grade frontend delivery with no additional infrastructure.

---

## 📈 Key Learning Outcomes

- Provisioned and managed a Linux server on AWS EC2 from scratch, including package installation, user configuration, and firewall rules
- Operated Docker and Docker Compose in a real cloud environment, handling image builds, container lifecycle, log inspection, and volume management over SSH
- Designed a multi-container networking topology where only necessary ports are exposed to the public internet
- Implemented a repeatable, low-downtime deployment workflow based on `git pull` + `docker compose up --build -d`
- Applied environment-based configuration management to separate secrets from source code across local and production environments
- Understood the operational difference between stateless containers (frontend, backend) and stateful services (PostgreSQL) and applied appropriate persistence strategies for each

---


