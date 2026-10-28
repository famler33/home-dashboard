import { describe, expect, it } from 'vitest';
import { fitRows } from './fit-rows';

const ones = (count: number) => Array.from({ length: count }, () => 1);
const day = (date: string, rows: number, partial = false) => ({
  date,
  head: 1,
  rows: ones(rows),
  partial,
});
const plan = (kita: number, days: ReturnType<typeof day>[]) => ({
  kita: ones(kita),
  kitaHead: 1,
  more: 1,
  days,
});

// Covers: NFR-2, AC-6
describe('fitRows', () => {
  it('shows everything when it fits and reserves nothing', () => {
    const result = fitRows(plan(2, [day('a', 3, true), day('b', 2)]), 12);
    expect(result).toEqual({
      kita: 2,
      days: [
        { date: 'a', shown: 3, collapsed: false, hidden: false },
        { date: 'b', shown: 2, collapsed: false, hidden: false },
      ],
      more: 0,
    });
  });

  it('fills whole rows by priority and ends with + n weitere', () => {
    // kita 3 rows, today 1+4, tomorrow 1+3, later 1+5  -> budget 10 leaves 9 after the more row
    const result = fitRows(plan(2, [day('a', 4, true), day('b', 3), day('c', 5)]), 10);
    expect(result.kita).toBe(2);
    expect(result.days[0]).toEqual({ date: 'a', shown: 4, collapsed: false, hidden: false });
    // 3 rows used by kita, 5 by today = 8, one left: tomorrow collapses to its heading
    expect(result.days[1]).toEqual({ date: 'b', shown: 0, collapsed: true, hidden: false });
    expect(result.days[2]).toEqual({ date: 'c', shown: 0, collapsed: false, hidden: true });
    expect(result.more).toBe(5);
  });

  it('never cuts a row in half and the shown rows never exceed the budget', () => {
    for (let budget = 1; budget <= 20; budget += 1) {
      const result = fitRows(
        plan(2, [day('a', 4, true), day('b', 3), day('c', 5), day('d', 2)]),
        budget,
      );
      const used =
        (result.kita > 0 ? result.kita + 1 : 0) +
        result.days.reduce(
          (sum, entry) => sum + (entry.hidden ? 0 : 1 + (entry.collapsed ? 0 : entry.shown)),
          0,
        ) +
        (result.more > 0 ? 1 : 0);
      expect(used, `budget ${budget}`).toBeLessThanOrEqual(budget);
    }
  });

  it('never drops today silently: hidden events of today are counted in more', () => {
    const result = fitRows(plan(0, [day('a', 6, true), day('b', 2)]), 5);
    // one row for more, four left: heading + three events of today
    expect(result.days[0]).toEqual({ date: 'a', shown: 3, collapsed: false, hidden: false });
    expect(result.days[1]?.hidden).toBe(true);
    expect(result.more).toBe(3 + 2);
  });

  it('truncates the Kita block only when nothing else fits', () => {
    const result = fitRows(plan(4, [day('a', 1, true)]), 4);
    expect(result.kita).toBe(2);
    expect(result.more).toBeGreaterThan(0);
  });

  it('handles an empty plan and a budget of zero', () => {
    expect(fitRows(plan(0, []), 5)).toEqual({ kita: 0, days: [], more: 0 });
    const none = fitRows(plan(0, [day('a', 2, true)]), 0);
    expect(none.days[0]?.hidden).toBe(true);
  });

  it('works with different row heights', () => {
    const result = fitRows(
      {
        kita: [],
        kitaHead: 0,
        more: 10,
        days: [{ date: 'a', head: 20, rows: [40, 30, 40], partial: true }],
      },
      100,
    );
    // 10 for the more row, 20 heading, 40 + 30 = 70 -> exactly 100; the third row is counted in more
    expect(result.days[0]).toEqual({ date: 'a', shown: 2, collapsed: false, hidden: false });
    expect(result.more).toBe(1);
  });

  it('fills a partial day with as many rows as fit instead of collapsing it', () => {
    // today 1+2 rows, tomorrow 1+4 rows (partial), budget 7: one row for more, today 3, tomorrow heading + 2
    const result = fitRows(plan(0, [day('a', 2, true), day('b', 4, true)]), 7);
    expect(result.days[1]).toEqual({ date: 'b', shown: 2, collapsed: false, hidden: false });
    expect(result.more).toBe(2);
  });

  it('still collapses days that are not partial', () => {
    const result = fitRows(plan(0, [day('a', 2, true), day('b', 4)]), 6);
    expect(result.days[1]).toEqual({ date: 'b', shown: 0, collapsed: true, hidden: false });
  });

  it('does not count a phantom row (the empty-today text) as a hidden appointment', () => {
    const result = fitRows(
      {
        kita: [],
        kitaHead: 0,
        more: 1,
        days: [
          { date: 'a', head: 1, rows: [1], partial: true, phantom: true },
          { date: 'b', head: 1, rows: [1, 1], partial: false },
        ],
      },
      2,
    );
    // one row for more, one left: today shows its heading only, its text row is not an appointment
    expect(result.days[0]).toEqual({ date: 'a', shown: 0, collapsed: false, hidden: false });
    expect(result.more).toBe(2);
  });
});
