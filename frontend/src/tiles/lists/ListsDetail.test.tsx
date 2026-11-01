import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import golden from '../../../../backend/test/fixtures/lists/lists.state.sample.json';
import snapshotJson from '../../../../backend/test/fixtures/lists/lists.snapshot.sample.json';
import type { Snapshot } from '../../api/types';
import { de } from '../../i18n/de';
import { ListsProvider } from '../../lists/ListsProvider';
import { Shell } from '../../shell/Shell';
import { contextFixture, renderWithProviders } from '../../test-utils';

const snapshot = snapshotJson as unknown as Snapshot;

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(golden), { status: 200 })),
  );
});
afterEach(() => vi.unstubAllGlobals());

// Covers: FR-12, AC-52, AC-53, AC-58
describe('lists detail view on the wall', () => {
  it('opens the complete lists from the tile heading and edits them in the same editor', async () => {
    renderWithProviders(
      <ListsProvider>
        <Shell layout="tablet" />
      </ListsProvider>,
      contextFixture(snapshot),
    );
    fireEvent.click(screen.getByRole('button', { name: de.lists.open }));
    const dialog = await screen.findByRole('dialog', { name: de.lists.open });
    expect(within(dialog).getByRole('region', { name: de.lists.shopping })).toBeInTheDocument();
    expect(within(dialog).getByRole('region', { name: de.lists.todos })).toBeInTheDocument();
    expect(within(dialog).getAllByRole('checkbox')[0]!.className).toMatch(/min-h-14/);
    expect(within(dialog).getByRole('button', { name: de.lists.addTodo })).toBeInTheDocument();
    expect(
      within(dialog).getByRole('button', { name: de.lists.manageCategories }),
    ).toBeInTheDocument();
  });
});
