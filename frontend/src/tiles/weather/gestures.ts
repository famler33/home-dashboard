export type Gesture = 'tap' | 'swipe-left' | 'swipe-right' | 'none';

const TAP_MAX_PX = 10;
const SWIPE_MIN_PX = 60;
const SWIPE_DOMINANCE = 1.5;

/** Classifies a pointer movement (release minus press): tap, horizontal swipe or neither. */
export function classifyGesture(move: { dx: number; dy: number }): Gesture {
  const ax = Math.abs(move.dx);
  const ay = Math.abs(move.dy);
  if (ax < TAP_MAX_PX && ay < TAP_MAX_PX) return 'tap';
  if (ax >= SWIPE_MIN_PX && ax >= SWIPE_DOMINANCE * ay)
    return move.dx < 0 ? 'swipe-left' : 'swipe-right';
  return 'none';
}
