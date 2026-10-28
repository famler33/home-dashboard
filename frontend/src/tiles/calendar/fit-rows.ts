export interface FitPlan {
  /** Number of Kita lines (the block adds one heading row when there are lines). */
  kita: number;
  /** Per day the number of body rows (events, or one row for the empty-today text). */
  days: { date: string; rows: number; isToday: boolean }[];
}

export interface FitResult {
  kita: number;
  days: { date: string; shown: number; collapsed: boolean; hidden: boolean }[];
  /** Events that are not visible as a row and not counted in a collapsed heading. */
  more: number;
}

/**
 * Fills whole rows by priority (Kita block, today, tomorrow, later days). Days that do not fit
 * collapse to their heading with a count, then disappear; the last row becomes "+ n weitere".
 */
export function fitRows(plan: FitPlan, budget: number): FitResult {
  const kitaRows = plan.kita > 0 ? plan.kita + 1 : 0;
  const total = kitaRows + plan.days.reduce((sum, day) => sum + 1 + day.rows, 0);
  if (total <= budget) {
    return {
      kita: plan.kita,
      days: plan.days.map((day) => ({
        date: day.date,
        shown: day.rows,
        collapsed: false,
        hidden: false,
      })),
      more: 0,
    };
  }

  let available = Math.max(0, budget - 1);
  let more = 0;

  let kita = 0;
  if (plan.kita > 0) {
    if (available >= kitaRows) {
      kita = plan.kita;
      available -= kitaRows;
    } else {
      kita = Math.max(0, available - 1);
      more += plan.kita - kita;
      available = 0;
    }
  }

  const days = plan.days.map((day) => {
    const need = 1 + day.rows;
    if (available >= need) {
      available -= need;
      return { date: day.date, shown: day.rows, collapsed: false, hidden: false };
    }
    if (available >= 1 && day.isToday) {
      const shown = available - 1;
      more += day.rows - shown;
      available = 0;
      return { date: day.date, shown, collapsed: false, hidden: false };
    }
    if (available >= 1) {
      available -= 1;
      return { date: day.date, shown: 0, collapsed: true, hidden: false };
    }
    more += day.rows;
    return { date: day.date, shown: 0, collapsed: false, hidden: true };
  });

  return { kita, days, more };
}
