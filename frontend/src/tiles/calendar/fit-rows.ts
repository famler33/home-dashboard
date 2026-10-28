export interface FitPlan {
  /** Height of every Kita line. */
  kita: number[];
  /** Height of the Kita block heading (padding included); only counted when there are lines. */
  kitaHead: number;
  /** Height of the "+ n weitere" row, reserved whenever something has to be dropped. */
  more: number;
  /** Per day the heading height and the height of every body row (the empty-today text is one row). */
  days: { date: string; head: number; rows: number[]; partial: boolean }[];
}

export interface FitResult {
  /** Kita lines shown. */
  kita: number;
  days: { date: string; shown: number; collapsed: boolean; hidden: boolean }[];
  /** Events that are not visible as a row and not counted in a collapsed heading. */
  more: number;
}

const sum = (values: readonly number[]): number =>
  values.reduce((total, value) => total + value, 0);

/** How many leading rows fit into `room` after a heading of `head`; -1 when even the heading does not fit. */
function rowsThatFit(head: number, rows: readonly number[], room: number): number {
  if (room < head) return -1;
  let used = head;
  let count = 0;
  for (const row of rows) {
    if (used + row > room) break;
    used += row;
    count += 1;
  }
  return count;
}

/**
 * Fills whole rows by priority (Kita block, today, tomorrow, later days). Partial days (today and tomorrow) get as many rows as
 * fit; later days that do not fit
 * collapse to their heading with a count, then disappear; the last row becomes "+ n weitere".
 * Heights and budget share one unit (pixels in the browser).
 */
export function fitRows(plan: FitPlan, budget: number): FitResult {
  const kitaTotal = plan.kita.length > 0 ? plan.kitaHead + sum(plan.kita) : 0;
  const total = kitaTotal + plan.days.reduce((acc, day) => acc + day.head + sum(day.rows), 0);
  if (total <= budget) {
    return {
      kita: plan.kita.length,
      days: plan.days.map((day) => ({
        date: day.date,
        shown: day.rows.length,
        collapsed: false,
        hidden: false,
      })),
      more: 0,
    };
  }

  let available = Math.max(0, budget - plan.more);
  let more = 0;

  let kita = 0;
  if (plan.kita.length > 0) {
    if (available >= kitaTotal) {
      kita = plan.kita.length;
      available -= kitaTotal;
    } else {
      kita = Math.max(0, rowsThatFit(plan.kitaHead, plan.kita, available));
      more += plan.kita.length - kita;
      available = 0;
    }
  }

  const days = plan.days.map((day) => {
    const need = day.head + sum(day.rows);
    if (available >= need) {
      available -= need;
      return { date: day.date, shown: day.rows.length, collapsed: false, hidden: false };
    }
    if (available >= day.head && day.partial) {
      const shown = Math.max(0, rowsThatFit(day.head, day.rows, available));
      more += day.rows.length - shown;
      available = 0;
      return { date: day.date, shown, collapsed: false, hidden: false };
    }
    if (available >= day.head) {
      available -= day.head;
      return { date: day.date, shown: 0, collapsed: true, hidden: false };
    }
    more += day.rows.length;
    return { date: day.date, shown: 0, collapsed: false, hidden: true };
  });

  return { kita, days, more };
}
