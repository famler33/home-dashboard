export interface Source<T = unknown> {
  /** kebab-case, unique */
  readonly id: string;
  readonly intervalSeconds: number;
  /** Convention: twice the interval. */
  readonly staleAfterSeconds: number;
  readonly timeoutMs: number;
  fetch(signal: AbortSignal): Promise<T>;
}
