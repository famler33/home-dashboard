import { describe, expect, it } from 'vitest';
import { i18n } from '../../i18n';
import { rainText } from './rain-text';

const t = i18n.t.bind(i18n);
const at = (hhmm: string) => Date.parse(`2026-10-28T${hhmm}:00Z`);

// Covers: FR-6, AC-13, AC-14 (long and short sentences)
describe('rainText', () => {
  it.each([
    [{ kind: 'none' as const }, 'Kein Regen in den nächsten 2 Stunden', 'Kein Regen in 2 Std.'],
    [
      { kind: 'starts' as const, startsAt: at('14:15'), durationMin: 40, beyondHorizon: false },
      'Regen ab 15:15, ca. 40 Min.',
      'Regen ab 15:15 · 40 Min.',
    ],
    [
      { kind: 'starts' as const, startsAt: at('14:15'), durationMin: 45, beyondHorizon: true },
      'Regen ab 15:15, mindestens 45 Min.',
      'Regen ab 15:15 · ≥ 45 Min.',
    ],
    [
      { kind: 'raining' as const, endsAt: at('14:30'), horizonEnd: at('16:00') },
      'Es regnet, Ende gegen 15:30',
      'Regen bis ca. 15:30',
    ],
    [
      { kind: 'raining' as const, endsAt: null, horizonEnd: at('16:00') },
      'Es regnet, mindestens bis 17:00',
      'Regen bis ≥ 17:00',
    ],
  ])('writes %j in a long and a short form', (statement, long, short) => {
    expect(rainText(t, 'Europe/Berlin', statement)).toBe(long);
    expect(rainText(t, 'Europe/Berlin', statement, true)).toBe(short);
  });

  it('keeps the short form at most as long as the long form', () => {
    const statement = {
      kind: 'starts' as const,
      startsAt: at('14:15'),
      durationMin: 40,
      beyondHorizon: false,
    };
    expect(rainText(t, 'Europe/Berlin', statement, true).length).toBeLessThan(
      rainText(t, 'Europe/Berlin', statement).length,
    );
  });
});
