import { describe, expect, it, vi } from 'vitest';
import fixture from '../../../backend/test/fixtures/snapshot.sample.json';
import { snapshotFixture } from '../test-fixtures';
import { fetchSnapshot, SnapshotError } from './client';
import { isSnapshot } from './types';

// Covers: FR-9, AC-22 (contract)
describe('snapshot contract', () => {
  it('accepts the backend-owned golden snapshot fixture', () => {
    expect(isSnapshot(fixture)).toBe(true);
  });

  it('accepts the shared frontend fixture builder output', () => {
    expect(isSnapshot(snapshotFixture())).toBe(true);
  });

  it.each([
    ['null', null],
    ['a missing buildId', { ...fixture, buildId: undefined }],
    ['an unknown status', { ...fixture, sources: [{ ...fixture.sources[0], status: 'broken' }] }],
    ['sources that are not an array', { ...fixture, sources: {} }],
    ['missing settings', { ...fixture, settings: undefined }],
  ])('rejects %s', (_label, value) => {
    expect(isSnapshot(value)).toBe(false);
  });
});

describe('fetchSnapshot', () => {
  it('requests the snapshot without caching and returns the parsed body', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(fixture), { status: 200 }));
    const signal = new AbortController().signal;
    const result = await fetchSnapshot(signal, fetchImpl as unknown as typeof fetch);
    expect(result.buildId).toBe('3f9c2ab');
    expect(fetchImpl).toHaveBeenCalledWith('/api/v1/snapshot', { cache: 'no-store', signal });
  });

  it('throws a SnapshotError for non-200 responses', async () => {
    const fetchImpl = async () => new Response('{}', { status: 503 });
    await expect(
      fetchSnapshot(new AbortController().signal, fetchImpl as unknown as typeof fetch),
    ).rejects.toBeInstanceOf(SnapshotError);
  });

  it('throws a SnapshotError for bodies that are not a snapshot', async () => {
    const fetchImpl = async () => new Response('{"hello":1}', { status: 200 });
    await expect(
      fetchSnapshot(new AbortController().signal, fetchImpl as unknown as typeof fetch),
    ).rejects.toBeInstanceOf(SnapshotError);
  });

  it('throws a SnapshotError for non-JSON bodies', async () => {
    const fetchImpl = async () => new Response('<html>', { status: 200 });
    await expect(
      fetchSnapshot(new AbortController().signal, fetchImpl as unknown as typeof fetch),
    ).rejects.toBeInstanceOf(SnapshotError);
  });
});
