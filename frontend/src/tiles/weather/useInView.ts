import { useEffect, useState, type RefObject } from 'react';

/** True while the element is visible; without IntersectionObserver the element counts as visible. */
export function useInView(ref: RefObject<Element | null>): boolean {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver(([entry]) =>
      setVisible(entry?.isIntersecting ?? true),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return visible;
}
