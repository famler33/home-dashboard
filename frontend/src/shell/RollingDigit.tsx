import { AnimatePresence, m } from 'motion/react';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

/** One clock digit that rolls to its next value; static under reduced motion. */
export function RollingDigit({ value }: { value: string }) {
  const reduced = usePrefersReducedMotion();

  if (reduced) {
    return (
      <span aria-hidden="true" className="inline-block w-[0.62em] text-center">
        {value}
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      className="relative inline-block h-[1.1em] w-[0.62em] overflow-hidden text-center align-bottom"
    >
      <AnimatePresence initial={false} mode="popLayout">
        <m.span
          key={value}
          initial={{ y: '60%', opacity: 0 }}
          animate={{ y: '0%', opacity: 1 }}
          exit={{ y: '-60%', opacity: 0 }}
          transition={{ type: 'spring', stiffness: 140, damping: 22 }}
          className="inline-block"
        >
          {value}
        </m.span>
      </AnimatePresence>
    </span>
  );
}
