import { useEffect, useRef, useState } from 'react';

/**
 * How many whole rows fit into the body. The probe is one row of the tallest row type, so
 * the estimate is conservative and nothing is clipped. `null` means "no limit" (phone, or no measurement).
 */
export function useFittingRows(enabled: boolean) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const probeRef = useRef<HTMLDivElement>(null);
  const [budget, setBudget] = useState<number | null>(null);

  useEffect(() => {
    const body = bodyRef.current;
    const probe = probeRef.current;
    if (!enabled || !body || !probe || typeof ResizeObserver === 'undefined') return undefined;
    const measure = () => {
      const rowHeight = probe.offsetHeight;
      const height = body.clientHeight;
      setBudget(rowHeight > 0 && height > 0 ? Math.floor(height / rowHeight) : null);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(body);
    observer.observe(probe);
    return () => observer.disconnect();
  }, [enabled]);

  return { bodyRef, probeRef, budget: enabled ? budget : null };
}
