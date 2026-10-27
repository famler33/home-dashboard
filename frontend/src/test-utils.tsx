import { render, type RenderResult } from '@testing-library/react';
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
): RenderResult {
  return render(
    <I18nextProvider i18n={i18n}>
      <SnapshotContext.Provider value={context}>{ui}</SnapshotContext.Provider>
    </I18nextProvider>,
  );
}
