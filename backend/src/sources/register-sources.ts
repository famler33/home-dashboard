import type { Scheduler } from '../scheduler/scheduler.js';
import type { Source } from './source.js';
import type { SourceRunner } from './source-runner.js';

export function registerSources(
  scheduler: Scheduler,
  runner: SourceRunner,
  sources: readonly Source[],
): void {
  for (const source of sources) {
    scheduler.every(`source:${source.id}`, source.intervalSeconds * 1000, () =>
      runner.refresh(source),
    );
  }
}
