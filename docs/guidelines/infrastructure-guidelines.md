# Infrastructure Guidelines

Scope: all files under `infrastructure/`. Start short — `reconcile-docs` extends this
file after every epic.

## Environment Structure

- One production-like environment: a Synology NAS (Container Manager) in the home
  network. Local development on the Mac. Further environments: <TODO: offen>.

## Frontend Hosting

- The built SPA is served as part of the containerized stack; how (backend static
  serving vs. separate web container): <TODO: offen>.

## Compute Platform (Backend)

- Docker Compose; `restart: unless-stopped`; images pinned and built for the NAS CPU
  architecture (check Intel vs. ARM): <TODO: offen>.

## Database

- SQLite file on a persistent volume that survives container updates. Backup
  approach: <TODO: offen>.

## Networking

- Reachable only inside the home network; no router port forwarding. Hostname/port
  and optional reverse proxy: <TODO: offen>.

## Secrets

- Provided via an environment file on the NAS; never in the image or repository.

## Tags

Not applicable (no cloud resources).

## Health Checks

- Backend exposes a health endpoint used by the compose healthcheck. Path:
  <TODO: offen>.
