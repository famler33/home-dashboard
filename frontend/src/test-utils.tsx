import { render, type RenderResult } from '@testing-library/react';
import type { i18n as I18nInstance } from 'i18next';
import type { ReactElement } from 'react';
import { I18nextProvider } from 'react-i18next';
import type { Snapshot } from './api/types';
import { i18n } from './i18n';
import { SnapshotContext, type SnapshotContextValue } from './snapshot/snapshot-context';
import { snapshotFixture } from './test-fixtures';

export function contextFixture(
  snapshot: Snapshot | null = snapshotFixture(),
  overrides: Partial<SnapshotContextValue> = {},
): SnapshotContextValue {
  return {
    snapshot,
    receivedAtMonotonic: snapshot ? 0 : null,
    nowMono: 0,
    offline: false,
    ...overrides,
  };
}

export function renderWithProviders(
  ui: ReactElement,
  context: SnapshotContextValue = contextFixture(),
  instance: I18nInstance = i18n,
): RenderResult {
  return render(
    <I18nextProvider i18n={instance}>
      <SnapshotContext.Provider value={context}>{ui}</SnapshotContext.Provider>
    </I18nextProvider>,
  );
}

/** Replace window.matchMedia; `matches` decides per query string. */
export function mockMatchMedia(matches: (query: string) => boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string): MediaQueryList =>
      ({
        matches: matches(query),
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList,
  });
}
