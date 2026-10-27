import { useSyncExternalStore } from 'react';
import { tabletMediaQuery } from '../styles/tokens';

export type LayoutMode = 'tablet' | 'phone';

function subscribe(onChange: () => void): () => void {
  const query = window.matchMedia(tabletMediaQuery);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

const read = (): LayoutMode => (window.matchMedia(tabletMediaQuery).matches ? 'tablet' : 'phone');

export function useLayoutMode(): LayoutMode {
  return useSyncExternalStore(subscribe, read);
}
