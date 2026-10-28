import golden from '../../../../backend/test/fixtures/calendar/calendar.snapshot.sample.json';
import { describe, expect, it } from 'vitest';
import type { Snapshot } from '../../api/types';
import { isSnapshot } from '../../api/types';
import { mergeCalendars } from './merge';
import { isCalendarPayload, isCalendarSettings } from './types';

// Covers: FR-7, NFR-7, AC-15 (contract with the backend-owned golden snapshot)
describe('calendar snapshot contract', () => {
  it('accepts the backend golden snapshot, its calendar settings and its payloads', () => {
    expect(isSnapshot(golden)).toBe(true);
    const snapshot = golden as unknown as Snapshot;
    expect(isCalendarSettings(snapshot.settings.calendar)).toBe(true);
    for (const source of snapshot.sources)
      expect(isCalendarPayload(source.data), source.id).toBe(true);
  });

  it('merges the golden events with the projected names and colours', () => {
    const snapshot = golden as unknown as Snapshot;
    const merged = mergeCalendars(snapshot.sources, snapshot.settings.calendar!);
    expect(merged.length).toBeGreaterThan(10);
    expect(new Set(merged.map((event) => event.calendar))).toEqual(new Set(['family', 'person-1']));
  });
});
