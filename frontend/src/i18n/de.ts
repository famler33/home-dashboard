export const de = {
  app: { name: 'Home-Dashboard' },
  clock: { ariaLabel: 'Es ist {{time}} Uhr' },
  tiles: {
    weather: 'Wetter',
    calendar: 'Kalender',
    lists: 'Einkaufsliste & To-dos',
    news: 'Nachrichten',
    demo: 'Demo',
  },
  placeholder: {
    title: 'Kommt bald',
    hint: 'Diese Kachel wird in einer späteren Version freigeschaltet.',
  },
  demo: { value: 'Zählerstand' },
  states: {
    loading: { title: 'Wird geladen', hint: 'Die Daten werden abgerufen.' },
    neverLoaded: { title: 'Noch keine Daten', hint: 'Die erste Aktualisierung steht noch aus.' },
    empty: { title: 'Nichts zu zeigen', hint: 'Aktuell gibt es hier keine Einträge.' },
    error: {
      title: 'Quelle nicht erreichbar',
      hint: 'Es liegen noch keine Daten vor. Der Abruf wird erneut versucht.',
    },
    crashed: {
      title: 'Kachel gerade nicht verfügbar',
      hint: 'Die anderen Kacheln sind nicht betroffen.',
    },
  },
  tile: {
    lastUpdated: 'zuletzt aktualisiert {{relative}}',
    justNow: 'gerade eben',
    stale: 'Veraltet',
  },
  status: { offline: 'Keine Verbindung' },
  kiosk: { tapForFullscreen: 'Für Vollbild einmal tippen' },
  errors: {
    NOT_FOUND: 'Nicht gefunden',
    VALIDATION_FAILED: 'Anfrage ungültig',
    PAYLOAD_TOO_LARGE: 'Anfrage zu groß',
    INTERNAL_ERROR: 'Interner Fehler',
    SOURCE_FETCH_FAILED: 'Quelle konnte nicht abgerufen werden',
    SOURCE_TIMEOUT: 'Quelle antwortet nicht rechtzeitig',
  },
} as const;

export type Dictionary = typeof de;
