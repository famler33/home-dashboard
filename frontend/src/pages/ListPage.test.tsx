import { render, screen, waitFor, within } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import golden from '../../../backend/test/fixtures/lists/lists.state.sample.json';
import snapshotJson from '../../../backend/test/fixtures/lists/lists.snapshot.sample.json';
import { App } from '../App';
import { i18n } from '../i18n';
import { de } from '../i18n/de';
import { ListsProvider } from '../lists/ListsProvider';
import { SnapshotContext } from '../snapshot/snapshot-context';
import { contextFixture } from '../test-utils';
import type { Snapshot } from '../api/types';
import { ListPage } from './ListPage';

const snapshot = snapshotJson as unknown as Snapshot;
const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

function routedFetch() {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith('/api/v1/snapshot')) return json(snapshot);
    if (url.endsWith('/api/v1/lists')) return json(golden);
    return new Response('{}', { status: 404 });
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  vi.stubGlobal('fetch', routedFetch());
});
afterEach(() => {
  vi.unstubAllGlobals();
  window.history.pushState({}, '', '/');
});

// Covers: FR-7, AC-5, AC-38, AC-40, AC-51
describe('list page', () => {
  it('renders both lists with add, check, change and remove controls', async () => {
    render(
      <I18nextProvider i18n={i18n}>
        <SnapshotContext.Provider value={contextFixture(snapshot)}>
          <ListsProvider fetchImpl={routedFetch()}>
            <ListPage />
          </ListsProvider>
        </SnapshotContext.Provider>
      </I18nextProvider>,
    );
    const shopping = await screen.findByRole('region', { name: de.lists.shopping });
    expect(within(shopping).getAllByRole('checkbox').length).toBeGreaterThan(0);
    expect(
      within(shopping).getAllByRole('button', { name: new RegExp(de.lists.remove) }).length,
    ).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: de.lists.addTodo })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: de.lists.editTodo }).length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(de.tiles.lists);
  });

  it('runs no drift, night schedule or kiosk logic on the list page', async () => {
    window.history.pushState({}, '', '/listen');
    render(
      <I18nextProvider i18n={i18n}>
        <App />
      </I18nextProvider>,
    );
    await screen.findByRole('region', { name: de.lists.shopping });
    expect(screen.queryByTestId('drift-wrapper')).toBeNull();
    expect(screen.queryByText(de.kiosk.tapForFullscreen)).toBeNull();
    expect(document.documentElement.getAttribute('data-theme')).not.toBe('night');
  });

  it('opens the list page at /listen and the dashboard everywhere else', async () => {
    window.history.pushState({}, '', '/');
    const dashboard = render(
      <I18nextProvider i18n={i18n}>
        <App />
      </I18nextProvider>,
    );
    await waitFor(() => expect(screen.queryByRole('heading', { level: 1 })).toBeNull());
    dashboard.unmount();
    window.history.pushState({}, '', '/listen/');
    render(
      <I18nextProvider i18n={i18n}>
        <App />
      </I18nextProvider>,
    );
    expect(
      await screen.findByRole('heading', { level: 1, name: de.tiles.lists }),
    ).toBeInTheDocument();
  });
});
