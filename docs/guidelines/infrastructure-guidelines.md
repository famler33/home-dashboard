# Infrastructure Guidelines

Scope: all files under `infrastructure/`. Start short — `reconcile-docs` extends this
file after every epic.

## Environment Structure

- One production-like environment: a Synology NAS (Container Manager) in the home
  network. Local development on the Mac (the backend serves the SPA, Vite proxies `/api` in
  development). No staging environment.

## Frontend Hosting

- The backend serves the built SPA from the same container and port (`STATIC_DIR`); there is no
  separate web container.

## Compute Platform (Backend)

- Docker Compose; `restart: unless-stopped`; one image built for `linux/amd64` (the NAS is Intel)
  from a pinned Debian slim Node image (glibc, not Alpine, for the prebuilt SQLite binary). The
  image installs dependencies without build scripts, runs as a numeric non-root user (the compose
  file overrides it with the NAS user and group) and contains no configuration. The build id is
  passed as a build argument and baked into the backend and the SPA bundle.
- The compose file is hardened (see the security guidelines) and has restrictive defaults: without
  `DASHBOARD_BIND_IP` the port is only reachable on the NAS itself. Always roll out through the
  deploy script; restarting the project in Container Manager without a build id looks for the
  placeholder image tag.

## Database

- SQLite file in the bind-mounted `data/` folder that survives container updates.
- Nightly online backup by the application into the bind-mounted `backup/` folder (mode 0700,
  atomic rename, newest N copies kept, database only); the NAS's own backup tools pick that folder
  up. Restore is a documented manual procedure (stop, copy, remove the WAL files, start).

## Networking

- Reachable only inside the home network; no router port forwarding. The NAS has a DHCP reservation,
  the router a local DNS entry (`dashboard.home`), the port is published on the NAS LAN address
  (default 8080, plain HTTP; the Wake Lock API therefore is not available, see the UX guidelines).
  No reverse proxy.

## Secrets

- `settings.yaml` and `credentials.yaml` in the NAS folder `config/`, mounted read-only; non-secret
  compose variables (bind address, port, user, group) in `.env` next to the compose file. Examples
  with placeholders are committed; the real files, `.env` and `scripts/deploy.env` are git-ignored.
- Updates: `scripts/deploy.sh` builds the image, streams it with `docker save | ssh | docker load`
  (no registry), uploads only the compose file, starts the new build, waits for "healthy", keeps the
  previous build for `--rollback` and prunes old image tags. `DRY_RUN=1` prints every step.

## Tags

Not applicable (no cloud resources).

## Health Checks

- The compose healthcheck calls `GET /api/v1/health` with a `node` one-liner (the slim image has no
  curl): interval 30 s, timeout 5 s, 3 retries, 20 s start period. Container logs are capped at
  10 MB x 3 files.
