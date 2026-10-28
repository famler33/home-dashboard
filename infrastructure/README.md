# Home-Dashboard auf dem Synology-NAS betreiben

Runbook für Installation, Updates, Rücksprung, Datensicherung und das Wandtablet.
Das Dashboard läuft als ein Docker-Container (Container Manager) auf dem Synology-NAS (Intel x86_64) und ist
nur im Heimnetz erreichbar.

## Überblick

| Teil | Ort |
| ---- | --- |
| Compose-Datei und Image | `infrastructure/` im Repository, per `scripts/deploy.sh` aufs NAS |
| Einstellungen, Zugangsdaten | nur auf dem NAS, Ordner `config/` (nie im Repository oder Image) |
| Daten (SQLite) | NAS-Ordner `data/` |
| Nächtliche Sicherung | NAS-Ordner `backup/` |
| Adresse | `http://dashboard.home` bzw. `http://<NAS-IP>:8080` (Standard-Port 8080) |

Auf dem NAS liegt alles unter einem Projektordner, z. B. `/volume1/docker/home-dashboard`:

```text
home-dashboard/
  docker-compose.yml   wird vom Deploy-Skript hochgeladen
  .env                 Adresse, Port, Benutzer (keine Geheimnisse), siehe .env.example
  config/              settings.yaml, credentials.yaml (nur lesend im Container)
  data/                dashboard.sqlite
  backup/              dashboard-JJJJMMTT-HHMMSS.sqlite
```

## Netzwerk und Zugriffsschutz

Das Dashboard darf nie aus dem Internet erreichbar sein. Es gibt keine Konten und kein Login: Jedes Gerät im
Heimnetz darf ansehen und, sobald die Listen-Funktion existiert, Listen ohne Login bearbeiten. Das ist eine
bewusste Entscheidung; sie gilt nur, wenn der Zugang zum Heimnetz geschützt ist.

1. **DHCP-Reservierung:** Im Router dem NAS eine feste LAN-Adresse geben (z. B. `192.168.1.20`). Der Container
   bindet seinen Port genau an diese Adresse (`DASHBOARD_BIND_IP`). Ändert sich die Adresse, ist das
   Dashboard nicht mehr erreichbar.
2. **Hostname:** Im Router (oder auf dem NAS) einen lokalen DNS-Eintrag `dashboard.home` auf diese Adresse
   anlegen. Kann der Router keine lokalen Namen, bleibt die feste IP-Adresse mit Port die Adresse.
3. **Keine Port-Weiterleitung** im Router für das NAS. **UPnP** im Router ausschalten.
4. **QuickConnect, DDNS und externer Zugriff** (Synology) dürfen den Dashboard-Port nicht veröffentlichen;
   den Port auch nicht über einen Reverse Proxy des NAS nach außen geben.
5. **Firewall (DSM):** Systemsteuerung → Sicherheit → Firewall: den Dashboard-Port nur aus dem LAN-Subnetz
   (z. B. `192.168.1.0/24`) erlauben, sonst verweigern.
6. **Gäste:** Gäste-Geräte gehören in ein getrenntes Gäste-WLAN, das das NAS nicht erreicht. Das ist eine
   Annahme dieser Installation: Wer im selben Netz wie das NAS ist, kann das Dashboard ohne Login sehen
   und (später) Listen ändern.
7. **Prüfen:** Vom Handy mit ausgeschaltetem WLAN (Mobilfunk) die Adresse aufrufen – es darf keine Antwort
   kommen. Zusätzlich die öffentliche IP des Anschlusses von außen auf den Port scannen lassen.

## Erstinstallation

Voraussetzungen: DSM 7.2 oder neuer mit **Container Manager**, SSH aktiviert (nur LAN), Zugriff auf den Router.

1. **Container Manager starten lassen:** Im Paket-Zentrum prüfen, dass Container Manager installiert ist und
   nach einem Neustart automatisch startet. Projekte mit `restart: unless-stopped` starten dann von selbst
   wieder.
2. **Ordner anlegen** (Dateistation oder SSH): `config`, `data`, `backup` unter `/volume1/docker/home-dashboard`.
3. **Benutzer für das Dashboard festlegen:** UID und GID des NAS-Benutzers ermitteln, dem diese Ordner
   gehören (`id <benutzer>` per SSH, z. B. `1000` und `100`). Den Ordnern genau diesen Besitzer geben.
4. **Berechtigungen:** `backup/` mit Modus `0700`, `config/credentials.yaml` mit Modus `0600`, beides im
   Besitz dieses Benutzers (sonst kann der Container die Datei nicht lesen). Den Backup-Ordner nicht in
   freigegebenen oder Medienordnern anlegen.
5. **Einstellungen:** `infrastructure/config.example/settings.example.yaml` nach `config/settings.yaml`
   kopieren und anpassen (Zeitzone, Standort, Nachtzeiten, Backup). `credentials.example.yaml` nach
   `config/credentials.yaml` kopieren, nur echte Werte eintragen, die spätere Kacheln brauchen. Beide
   Dateien bleiben auf dem NAS.
6. **`.env` anlegen:** `infrastructure/.env.example` nach `.env` im Projektordner kopieren: `DASHBOARD_BIND_IP`
   (die reservierte NAS-Adresse), `DASHBOARD_PORT`, `DASHBOARD_UID`, `DASHBOARD_GID`. Nie `0.0.0.0` eintragen.
7. **Deploy-Benutzer und SSH-Schlüssel einrichten** (siehe unten), dann am Mac `scripts/deploy.env` aus
   `scripts/deploy.env.example` erstellen.
8. **Ersten Stand ausrollen:** am Mac `scripts/deploy.sh`. Das Skript baut das Image für `linux/amd64`, schickt
   es per SSH aufs NAS, lädt nur die Compose-Datei hoch, startet das Projekt und wartet auf „healthy“.
9. **Prüfen:** In Container Manager steht das Projekt `home-dashboard` auf „läuft“ und der Container auf
   „healthy“. `http://dashboard.home` im Browser öffnet das Dashboard.

### Deploy-Benutzer und SSH-Schlüssel

- Auf dem Mac einen eigenen Schlüssel nur für Deployments erzeugen und mit Passphrase schützen
  (macOS-Schlüsselbund): `ssh-keygen -t ed25519 -f ~/.ssh/home-dashboard-deploy`.
- Auf dem NAS einen eigenen Benutzer (z. B. `dashboard-deploy`) mit der öffentlichen Schlüsseldatei
  (`authorized_keys`) anlegen. Passwort-Login für diesen Benutzer ausschalten, SSH nur aus dem LAN zulassen.
- Den Host-Schlüssel des NAS einmalig prüfen und in `known_hosts` eintragen (`ssh-keyscan` und
  Fingerabdruck am NAS vergleichen). Das Skript verwendet `StrictHostKeyChecking=yes`, also keine
  automatische Annahme unbekannter Hosts.
- **Ehrlicher Hinweis:** Unter DSM ist Docker-Zugriff praktisch gleichbedeutend mit Root-Rechten. Der Benutzer
  braucht das Recht, `docker` auszuführen; je nach DSM-Version geht das nur mit Mitgliedschaft in der
  Administratoren-Gruppe. Dann bleibt der Benutzer ein dedizierter Schlüssel-Benutzer ohne Passwort, nur im
  LAN, und der Schlüssel liegt ausschließlich auf dem Mac.

## Update

Am Mac im Repository: `scripts/deploy.sh`. Das Skript:

1. baut ein neues Image mit eindeutiger Build-ID (`<git-Hash>-<Zeitstempel>`),
2. überträgt es per `docker save | ssh | docker load` (keine Registry, nichts verlässt das Heimnetz),
3. lädt nur `docker-compose.yml` hoch (nie Einstellungen oder Zugangsdaten),
4. merkt sich den bisherigen Stand in `.previous-build` und startet den neuen,
5. wartet auf „healthy“ und entfernt alte Image-Versionen (es bleiben `KEEP_TAGS`).

Immer über das Skript ausrollen: Die Compose-Datei enthält einen `build:`-Abschnitt und die Voreinstellung
`home-dashboard:dev`. Wer das Projekt in Container Manager ohne die gesetzte Build-ID neu startet oder
neu baut, sucht dieses Image und startet nicht den ausgerollten Stand.

Daten (`data/`), Sicherungen (`backup/`) und `config/` bleiben unverändert. Das geöffnete Tablet erkennt
die neue Build-ID und lädt sich selbst neu; manuelles Neuladen ist nicht nötig.
Für einen Probelauf ohne Wirkung: `DRY_RUN=1 scripts/deploy.sh`.

## Rollback

Läuft ein neuer Stand nicht gesund: `scripts/deploy.sh --rollback` startet den in `.previous-build`
gemerkten Stand wieder. Die Datenbank wird nicht zurückgesetzt. Hat der neue Stand das Datenbankschema
erweitert, startet der alte Stand mit der Meldung `DB_SCHEMA_NEWER_THAN_APP` nicht; dann zuerst die Daten
aus der letzten Sicherung wiederherstellen (nächster Abschnitt).

## Backup und Wiederherstellung

Jede Nacht zur Zeit `backup.time` schreibt der Container eine konsistente Kopie der Datenbank nach `backup/`
(`dashboard-JJJJMMTT-HHMMSS.sqlite`) und behält die letzten `backup.retention` Dateien. Die Sicherungen
enthalten nur die Datenbank, nie Einstellungen oder Zugangsdaten. Den Ordner `backup/` in Hyper Backup oder
eine andere NAS-Sicherung aufnehmen.

Wiederherstellen:

1. Projekt in Container Manager stoppen (oder `docker compose stop` im Projektordner).
2. Die gewünschte Datei `backup/dashboard-….sqlite` nach `data/dashboard.sqlite` kopieren.
3. Daneben liegende Dateien `data/dashboard.sqlite-wal` und `data/dashboard.sqlite-shm` löschen.
4. Projekt wieder starten und `http://dashboard.home` prüfen.

## Tablet einrichten

Das Dashboard läuft im Querformat im Browser im Vollbild. Für den Dauerbetrieb am Tablet:

- **Auto-Sperre ausschalten** (iPad: Einstellungen → Anzeige & Helligkeit → Automatische Sperre → Nie;
  Android: Bildschirm-Timeout auf Maximum bzw. „Immer an“, Entwickleroption „Aktiv lassen“ beim Laden).
  Das Dashboard kann den Bildschirm im normalen HTTP-Betrieb nicht selbst wachhalten: Die Wake-Lock-Schnittstelle
  der Browser (Wake Lock) funktioniert nur über HTTPS. Darum sind diese Tablet-Einstellungen nötig.
- **Vollbild:** einmal auf das Display tippen, dann geht die Seite in den Vollbildmodus. Nach einer Unterbrechung
  erscheint oben ein Hinweis; ein Tipp stellt den Vollbildmodus wieder her.
- **Zum Home-Bildschirm hinzufügen** (iPad/Safari: Teilen → Zum Home-Bildschirm) startet das Dashboard ohne
  Browserleiste im Vollbild; das Manifest legt Namen und Querformat fest.
- **Geführter Zugriff** (iPad) bzw. Kiosk-Modus/Bildschirm fixieren (Android) sperrt das Tablet auf die
  Dashboard-App, damit niemand versehentlich herausnavigiert.
- **Nachts:** Das Dashboard dimmt sich selbst ab `display.nightFrom` und verschiebt statische Elemente
  langsam gegen Einbrennen. Die Display-Helligkeit des Tablets zusätzlich niedrig stellen.
- **Akku:** Das Tablet dauerhaft am Netzteil betreiben; wenn möglich Ladeobergrenze (z. B. 80 %) aktivieren.
- **Kleine Bildschirme:** Das Wandlayout braucht Querformat mit mindestens 1024 × 750 oder 1180 × 700 Bildpunkten
  (CSS-Pixel; ein iPad mit 2048 × 1536 Pixeln meldet 1024 × 768). Auf kleineren Bildschirmen erscheint die scrollbare Handy-Ansicht.
- Die Adresse im Browser ist `http://dashboard.home` (oder die feste IP mit Port).

## Handy

Im Heimnetz-WLAN `http://dashboard.home` öffnen. Die Handy-Ansicht zeigt die Listen zuerst und darunter
kompakt die übrigen Kacheln. Ohne Login kann jedes Gerät im Heimnetz Listen ansehen und (nach der
Listen-Erweiterung) bearbeiten; siehe Abschnitt Netzwerk.

## Fehlersuche

| Symptom | Prüfen |
| ------- | ------ |
| Nicht erreichbar | NAS-Adresse noch die reservierte? `DASHBOARD_BIND_IP` in `.env` richtig? Firewall erlaubt den Port aus dem LAN? |
| Container startet nicht, Log nennt eine Datei | Besitzer und Modus von `config/`, `data/`, `backup/` passen zu `DASHBOARD_UID`/`DASHBOARD_GID`? `settings.yaml` gültig (die Meldung nennt den Schlüssel, nie den Wert)? |
| `DB_SCHEMA_NEWER_THAN_APP` | Ein älterer Stand wurde gestartet; Daten aus einer Sicherung wiederherstellen oder auf den neueren Stand wechseln. |
| Container „unhealthy“ | Log in Container Manager ansehen; `http://<NAS>:<Port>/api/v1/health` muss `{"status":"ok"}` liefern. |
| Kacheln gelb „Veraltet“ | Quelle oder Internet gestört; die zuletzt bekannten Daten bleiben sichtbar, der Abruf wird laufend wiederholt. |
| Punkt „Keine Verbindung“ | Das Tablet erreicht das NAS nicht (WLAN, NAS aus, Container gestoppt). Es erholt sich selbst. |
| Deploy bricht mit Host-Schlüssel-Fehler ab | `known_hosts` prüfen; Fingerabdruck am NAS vergleichen, nie Prüfung abschalten. |
| `docker: permission denied` beim Deploy | Docker-Rechte des Deploy-Benutzers prüfen (siehe Hinweis oben). |

## Aufräumen

Nur das Projekt stoppen und entfernen: Container Manager → Projekt → Löschen. Die Ordner `config/`,
`data/` und `backup/` bleiben erhalten, bis sie ausdrücklich gelöscht werden.
