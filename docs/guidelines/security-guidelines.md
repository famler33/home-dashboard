# Security Guidelines

Scope: the whole repository. Start short — `reconcile-docs` extends this file after
every epic.

Context: private family app on a NAS in the home network, no user accounts. Sensitive
assets: calendar data (including work calendars) and API/calendar credentials.

## Network Exposure

- Never exposed to the internet; no router port forwarding, UPnP off, no QuickConnect, DDNS or
  reverse-proxy exposure of the port. Remote access, if ever wanted, only via VPN (needs its own
  decision).
- The container publishes its port on the NAS LAN address only (never a bare port mapping, never
  host networking); the compose default is the loopback address. The NAS firewall allows the port
  from the LAN subnet only. Guest devices are assumed to be on a separate network that cannot reach
  the NAS.
- Container hardening: numeric non-root user, read-only root file system, all capabilities dropped,
  `no-new-privileges`, no privileged mode, no Docker socket.

## Authentication

- No login while the app is reachable only inside the home network. Revisit before
  any remote access. Any device in the home network may view the dashboard and edit lists from a
  phone without login (accepted risk: everyone on that network can edit). When list endpoints exist
  they need input validation and size limits; revisit rate limiting then.

## Authorization

- Not applicable while single-household. Calendar access is read-only.

## Anonymous / Operational Endpoints

- `GET /api/v1/health` is unauthenticated and returns exactly `{"status":"ok"}` or
  `{"status":"error"}`: no version, uptime, source names or error text. Health probes are not logged.

## Frontend Caching

- `Cache-Control: no-store` on every `/api/` response; the entry page and manifest are `no-cache`;
  only hashed assets are cached. No API keys or credentials in the bundle (checked by a test).
- Content security policy limited to the own origin (inline style attributes only), `nosniff`,
  `no-referrer`, `frame-ancestors 'none'`, no CORS. No third-party requests, fonts or analytics.

## Secrets

- API keys and calendar credentials only in `credentials.yaml` on the NAS, mounted read-only
  (mode 0600, owned by the container user); never in the repository, the image, the frontend bundle,
  logs or backups, and not in environment variables (they show up in `docker inspect`). The file is
  git-ignored and docker-ignored; a permissive mode only warns, an unreadable file stops the start.
- The frontend receives only an explicit allowlist of settings (time zone, display schedule); the
  location counts as private household data and stays in the backend.
- Configuration errors name the file and key, never the value.
- Credential type per calendar (ICS link, app password, OAuth): <TODO: offen — decided in the
  calendar epic>.
- The deploy script uses a dedicated passphrase-protected ed25519 key, key-only login, a pinned host
  key (`StrictHostKeyChecking=yes`), transfers only the image and the compose file and never echoes or
  transfers secrets. Docker access on DSM is effectively root-equivalent for the deploy user;
  keep SSH LAN-only.
