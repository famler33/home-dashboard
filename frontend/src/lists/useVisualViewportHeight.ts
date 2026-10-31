import { useEffect, useState } from 'react';

/** Height of the visible area (without the on-screen keyboard), `null` when the browser has no such API. */
export function useVisualViewportHeight(): number | null {
  const [height, setHeight] = useState<number | null>(() => window.visualViewport?.height ?? null);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return undefined;
    const update = () => setHeight(viewport.height);
    viewport.addEventListener('resize', update);
    return () => viewport.removeEventListener('resize', update);
  }, []);
  return height;
}
