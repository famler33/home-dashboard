import type { Source } from './source.js';

export interface DemoPayload {
  value: number;
}

export function createDemoSource(): Source<DemoPayload> {
  let counter = 0;
  return {
    id: 'demo',
    intervalSeconds: 60,
    staleAfterSeconds: 120,
    timeoutMs: 5_000,
    async fetch() {
      counter += 1;
      return { value: counter };
    },
  };
}
