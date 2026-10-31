import state from '../../../backend/test/fixtures/lists/lists.state.sample.json';
import snapshot from '../../../backend/test/fixtures/lists/lists.snapshot.sample.json';
import { describe, expect, it } from 'vitest';
import { isSnapshot } from './types';
import { isListsState, isListsSummary } from './lists-types';

// Covers: FR-1, FR-8, NFR-7 (contract with the backend-owned golden state and snapshot)
describe('lists contract', () => {
  it('accepts the backend golden state and the golden snapshot with its summary', () => {
    expect(isListsState(state)).toBe(true);
    expect(isSnapshot(snapshot)).toBe(true);
    const entry = (snapshot as { sources: { id: string; data: unknown }[] }).sources.find(
      (source) => source.id === 'lists',
    );
    expect(isListsSummary(entry?.data)).toBe(true);
  });

  it('rejects wrong shapes', () => {
    expect(isListsState({ ...state, rev: 'x' })).toBe(false);
    expect(isListsState({ ...state, shopping: [{ id: 1 }] })).toBe(false);
    expect(isListsState({ ...state, todos: [{ ...state.todos[0], priority: 'urgent' }] })).toBe(
      false,
    );
    expect(isListsState(null)).toBe(false);
    expect(isListsSummary({ epoch: 'e' })).toBe(false);
  });
});
