# Production Deployment — Deferred to Homelab Agent

**Date:** 2026-02-20
**Status:** Deferred
**Owner:** Homelab agent

---

## Overview

FinTrack has K8s base manifests from Phase 1 but they have never been battle-tested in a real cluster. This document outlines what exists, what's missing, and what the homelab agent should analyze and implement.

---

## What Exists

### Docker

- `docker-compose.yml` — 5 services: postgres:18, redis:8, api (FastAPI/uvicorn), worker (Celery), frontend (Next.js/bun)
- `api/Dockerfile` — Python 3.14 + uv, venv at `/opt/venv` (important: bind mount conflict fix)
- `frontend/Dockerfile` — Node/bun-based Next.js build

### K8s Manifests (Phase 1)

Location: Check `k8s/` directory if it exists. These were created in Phase 1 but may be outdated.

Expected structure:
- API + Worker as Deployments (same image, different command)
- Postgres as StatefulSet with PVC
- Redis as Deployment
- Frontend as Deployment
- Kustomize base with dev/prod overlays

---

## What Needs Analysis

### 1. Infrastructure

- **Ingress:** No ingress controller config. Need to decide: Traefik (common for homelabs) vs nginx-ingress.
- **TLS:** No cert management. Options: cert-manager with Let's Encrypt, or Cloudflare tunnel.
- **DNS:** How will the app be accessed? `fintrack.local`? A real domain?
- **Storage:** PVC for Postgres. What storage class is available on the homelab cluster?

### 2. Secrets Management

- `.env` file has: DATABASE_URL, REDIS_URL, JWT_SECRET_KEY, COOKIE_DOMAIN, CORS_ORIGINS
- Phase 7 will add: VAPID_PRIVATE_KEY, VAPID_PUBLIC_KEY
- Need K8s Secrets or sealed-secrets for all of these
- **Never commit real secrets** — use `op://` 1Password refs or sealed-secrets

### 3. Database

- Migrations: `alembic upgrade head` must run before API starts (init container or job)
- Backup strategy: pg_dump cron job to NFS/S3
- The test DB (`finance_test`) should NOT exist in production

### 4. Celery Worker

- Needs Celery Beat scheduler for recurring transactions (Phase 7)
- Consider: separate Beat container or co-located with worker
- Redis as broker — acceptable for homelab scale

### 5. Frontend

- Next.js needs `API_URL` (server-side, internal) and `NEXT_PUBLIC_API_URL` (client-side, external)
- These will differ: internal = `http://api:8000`, external = `https://fintrack.yourdomain.com/api` or separate subdomain
- Static assets could be served from a CDN or directly from the Next.js server

### 6. Monitoring

- No health check endpoints beyond `GET /health` on the API
- Consider: Prometheus metrics, Grafana dashboard
- Log aggregation: structured logs via `structlog` are already in place

### 7. PWA Considerations

- Service worker and manifest need to be served over HTTPS
- Push notifications require VAPID keys and a publicly reachable endpoint for push services
- Offline sync queue needs the API to be tolerant of slightly stale timestamps

---

## Recommended Approach

1. **Start with docker-compose on the homelab** — validate everything works outside of the dev machine first
2. **Then K8s** — once docker-compose is proven, migrate to K8s manifests
3. **Use Kustomize overlays** — `base/` for shared config, `overlays/prod/` for homelab-specific values
4. **GitOps** — ArgoCD or Flux for automated deployments from main branch

---

## Environment Variables Reference

| Variable | Example | Notes |
|----------|---------|-------|
| DATABASE_URL | postgresql+asyncpg://user:pass@postgres:5432/finance_db | Internal K8s service name |
| REDIS_URL | redis://redis:6379/0 | |
| JWT_SECRET_KEY | (generate with `openssl rand -hex 32`) | Must be stable across restarts |
| JWT_ALGORITHM | HS256 | |
| JWT_ACCESS_TOKEN_EXPIRE_MINUTES | 30 | |
| JWT_REFRESH_TOKEN_EXPIRE_DAYS | 30 | |
| COOKIE_SECURE | true | Must be true in production (HTTPS) |
| COOKIE_DOMAIN | fintrack.yourdomain.com | |
| CORS_ORIGINS | https://fintrack.yourdomain.com | |
| APP_ENV | production | |
| VAPID_PRIVATE_KEY | (generate with pywebpush) | Phase 7 |
| VAPID_PUBLIC_KEY | (generate with pywebpush) | Phase 7 |
| NEXT_PUBLIC_API_URL | https://fintrack.yourdomain.com/api | Client-side |
| API_URL | http://api:8000 | Server-side (internal) |

---

## Action Items for Homelab Agent

1. Audit existing K8s manifests (if any) against current docker-compose
2. Create/update manifests for all services
3. Add init container for Alembic migrations
4. Configure ingress + TLS
5. Set up secrets management
6. Add Celery Beat container for recurring transactions
7. Test full deployment end-to-end
8. Document the deployment process
