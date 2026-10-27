# Ticket: PROJ-XXXX
Type: feature

# Home-Dashboard (Familie)

## Ausgangslage
Zwei Personen wollen zu Hause ein Dashboard auf einem Wandtablet. Es soll auf einen Blick zeigen, was im Alltag gebraucht wird. Es läuft als Docker-Container auf einem Synology-NAS im Heimnetz. Eine einfache Einkaufsliste (mit Tailwind) gibt es bereits und läuft auf dem NAS; sie muss evtl. noch etwas angepasst werden.

## Ziel
Ein schönes, animiertes und gut aus der Distanz lesbares Dashboard für das Wandtablet, das mit minimalem Aufwand im Alltag nützlich ist.

## In Scope
- Wetter
- Kalender: gemeinsamer Apple-Kalender (iCloud) sowie die Google-Kalender der Arbeit beider Personen, in einer gemeinsamen Ansicht
- Einkaufsliste / To-dos (bestehende Einkaufsliste weiterverwenden bzw. anpassen)
- Wichtigste Nachrichten-Schlagzeilen, lokal und global

## Out of Scope
- Zugriff aus dem Internet / von unterwegs
- Smart-Home-Steuerung, ÖPNV, Müllabfuhr (spätere Lieferungen)
- Nutzerkonten

## Constraints / Guardrails
- Läuft als Docker auf einem Synology-NAS, nur im Heimnetz erreichbar.
- Hauptdarstellung auf einem Wandtablet im Browser (Vollbild), zusätzlich Bearbeitung der Listen vom Handy im WLAN.
- Design mit hohem Anspruch und Animationen, aber stabil im Dauerbetrieb auf einem Tablet.
- Kalender werden nur gelesen. Zugangsdaten bleiben auf dem NAS.

## Offene Fragen
- Wie wird auf iCloud- und Google-Kalender zugegriffen?
- Welche Wetter- und Nachrichtenquellen?
- Wo liegt der Code der bestehenden Einkaufsliste, und wird sie integriert oder neu gebaut?
- Welches Tablet (Auflösung, Ausrichtung) und welche NAS-Architektur (Intel/ARM)?
