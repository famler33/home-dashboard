// Control characters, bidi overrides and isolates, zero-width characters and line separators.
const unsafe = new RegExp(
  // eslint-disable-next-line no-control-regex
  '[\\u0000-\\u001f\\u007f-\\u009f\\u200b-\\u200f\\u2028\\u2029\\u202a-\\u202e\\u2060\\u2066-\\u2069\\ufeff]',
  'g',
);

/** Trimmed, NFC-normalised text without unsafe characters; `null` when empty or longer than `max`. */
export function sanitiseText(raw: string, max: number): string | null {
  const text = raw.normalize('NFC').replace(unsafe, '').replace(/\s+/g, ' ').trim();
  if (text === '' || [...text].length > max) return null;
  return text;
}

/** Comparison key for titles and names: German lowercase, so "Äpfel" and "äpfel" match. */
export function keyOf(text: string): string {
  return text.normalize('NFC').trim().toLocaleLowerCase('de');
}
