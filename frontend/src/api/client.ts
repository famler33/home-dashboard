import { isSnapshot, type Snapshot } from './types';

export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

export async function fetchSnapshot(
  signal: AbortSignal,
  fetchImpl: typeof fetch = fetch,
): Promise<Snapshot> {
  const response = await fetchImpl('/api/v1/snapshot', { cache: 'no-store', signal });
  if (!response.ok) throw new SnapshotError(`snapshot request failed with ${response.status}`);

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new SnapshotError('snapshot response is not JSON');
  }
  if (!isSnapshot(body)) throw new SnapshotError('snapshot response has an unexpected shape');
  return body;
}
