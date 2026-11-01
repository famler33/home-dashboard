import { useEffect, useRef, useState } from 'react';

export interface RowMetrics {
  /** Height of the body in pixels. */
  budget: number;
  /** Heights including the gap below, in pixels. */
  head: number;
  body: number;
  caption: number;
}

/**
 * Measures the body and one probe row per row type, so whole rows can be fitted by their real
 * heights. `null` means "no limit" (phone, or no measurement possible).
 */
export function useFittingRows(enabled: boolean) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const bodyRowRef = useRef<HTMLDivElement>(null);
  const captionRef = useRef<HTMLDivElement>(null);
  const [metrics, setMetrics] = useState<RowMetrics | null>(null);

  useEffect(() => {
    const body = bodyRef.current;
    const head = headRef.current;
    const bodyRow = bodyRowRef.current;
    const caption = captionRef.current;
    if (
      !enabled ||
      !body ||
      !head ||
      !bodyRow ||
      !caption ||
      typeof ResizeObserver === 'undefined'
    ) {
      return undefined;
    }
    const GAP = 4;
    const measure = () => {
      const next = {
        budget: body.clientHeight,
        head: head.offsetHeight + GAP,
        body: bodyRow.offsetHeight + GAP,
        caption: caption.offsetHeight + GAP,
      };
      setMetrics(next.budget > 0 && next.body > GAP && next.caption > GAP ? next : null);
    };
    measure();
    const observer = new ResizeObserver(measure);
    for (const element of [body, head, bodyRow, caption]) observer.observe(element);
    return () => observer.disconnect();
  }, [enabled]);

  return { bodyRef, headRef, bodyRowRef, captionRef, metrics: enabled ? metrics : null };
}
