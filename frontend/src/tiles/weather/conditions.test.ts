import { describe, expect, it } from 'vitest';
import { de } from '../../i18n/de';
import { conditionIds, conditionLabelKey, symbolKind } from './conditions';

// Covers: FR-2, AC-3, AC-28
describe('conditions', () => {
  it('has a German label for every condition id', () => {
    for (const id of conditionIds) {
      const key = conditionLabelKey(id).replace('weather.conditions.', '');
      expect((de.weather.conditions as Record<string, string>)[key], id).toBeTruthy();
    }
  });

  it('lists the ten conditions plus the neutral fallback', () => {
    expect(conditionIds).toHaveLength(11);
    expect(conditionIds).toContain('unknown');
  });

  it('maps every condition to a symbol kind', () => {
    for (const id of conditionIds) expect(symbolKind(id)).toBeTruthy();
  });

  it('uses a neutral label and symbol for unknown conditions', () => {
    expect(symbolKind('unknown')).toBe('unknown');
    expect(de.weather.conditions.unknown).toMatch(/\S/);
  });

  it('covers at least clear, partly cloudy, cloudy, rain, thunderstorm, snow and fog with distinct symbols', () => {
    const kinds = new Set(
      ['clear', 'partly-cloudy', 'overcast', 'rain', 'thunderstorm', 'snow', 'fog'].map((id) =>
        symbolKind(id as never),
      ),
    );
    expect(kinds.size).toBe(7);
  });
});
