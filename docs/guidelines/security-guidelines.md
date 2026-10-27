# Security Guidelines

Scope: the whole repository. Start short — `reconcile-docs` extends this file after
every epic.

Context: private family app on a NAS in the home network, no user accounts. Sensitive
assets: calendar data (including work calendars) and API/calendar credentials.

## Network Exposure

- Never exposed to the internet; no router port forwarding. Remote access, if ever
  wanted, only via VPN (needs its own decision).

## Authentication

- No login while the app is reachable only inside the home network. Revisit before
  any remote access. Whether lists may be edited from phones without login:
  <TODO: offen>.

## Authorization

- Not applicable while single-household. Calendar access is read-only.

## Anonymous / Operational Endpoints

- Health endpoint is unauthenticated and returns no data. Path: <TODO: offen>.

## Frontend Caching

<TODO: offen>

## Secrets

- API keys and calendar credentials only in the NAS environment file; never in the
  repository, the image, the frontend bundle or logs. Credential type per calendar
  (ICS link, app password, OAuth): <TODO: offen>.
