import { act, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { de } from '../i18n/de';
import { snapshotFixture, sourceFixture } from '../test-fixtures';
import { contextFixture, renderWithProviders } from '../test-utils';
import type { TileDefinition } from '../tiles/types';
import { PlaceholderTile } from '../tiles/PlaceholderTile';
import { useDetailBusy } from './detail-context';
import { Shell } from './Shell';

function Detail({ onClose }: { onClose(): void }) {
  const { setBusy } = useDetailBusy();
  return (
    <div>
      <p>Detailinhalt</p>
      <button type="button" onClick={onClose}>
        Fertig
      </button>
      <button type="button" onClick={() => setBusy(true)}>
        Entwurf
      </button>
      <button type="button" onClick={() => setBusy(false)}>
        Entwurf verwerfen
      </button>
    </div>
  );
}

const stub: TileDefinition = {
  id: 'stub',
  titleKey: 'tiles.lists',
  detailLabelKey: 'lists.open',
  detail: Detail,
  sourceId: 'stub',
  tablet: { col: 1, row: 5, colSpan: 5, rowSpan: 2 },
  phoneOrder: 0,
  Component: () => <p>Kacheltext</p>,
};
const plain: TileDefinition = {
  id: 'plain',
  titleKey: 'tiles.news',
  tablet: { col: 6, row: 1, colSpan: 7, rowSpan: 2 },
  phoneOrder: 1,
  Component: PlaceholderTile,
};
const registry = [stub, plain];
const context = () =>
  contextFixture(snapshotFixture({ sources: [sourceFixture({ id: 'stub', data: {} })] }));

beforeEach(() =>
  vi.useFakeTimers({
    now: Date.parse('2026-10-28T11:04:00Z'),
    toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'],
  }),
);
afterEach(() => vi.useRealTimers());

const opener = () => screen.getByRole('button', { name: de.lists.open });
const open = () => {
  renderWithProviders(<Shell layout="tablet" registry={registry} />, context());
  fireEvent.click(opener());
};

// Covers: FR-12, NFR-1, NFR-5, NFR-6, AC-52, AC-54, AC-56, AC-57, AC-58, AC-59
describe('detail view of a tile', () => {
  it('shows a heading button with an accessible name only for a tile that offers a detail view', () => {
    renderWithProviders(<Shell layout="tablet" registry={registry} />, context());
    expect(opener()).toBeInTheDocument();
    expect(opener().getAttribute('aria-haspopup')).toBe('dialog');
    expect(opener().className).toMatch(/min-h-14/);
    const plainRegion = screen.getByRole('region', { name: de.tiles.news });
    expect(within(plainRegion).queryByRole('button')).toBeNull();
  });

  it('opens a labelled modal dialog with the back control focused and the background inert', () => {
    open();
    const dialog = screen.getByRole('dialog', { name: de.lists.open });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(within(dialog).getByText('Detailinhalt')).toBeInTheDocument();
    const back = within(dialog).getByRole('button', { name: de.detail.back });
    expect(back).toHaveFocus();
    expect(back.className).toMatch(/min-h-14/);
    expect(document.querySelector('[inert]')).not.toBeNull();
    expect(document.querySelector('[inert]')?.contains(dialog)).toBe(false);
  });

  it('renders the overlay inside the drifting shell with the shared fade', () => {
    open();
    const wrapper = screen.getByTestId('drift-wrapper');
    const dialog = within(wrapper).getByRole('dialog');
    expect(dialog.className).toContain('view-enter');
  });

  it('closes with the back control and returns focus to the heading button', () => {
    open();
    fireEvent.click(screen.getByRole('button', { name: de.detail.back }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(opener()).toHaveFocus();
    expect(document.querySelector('[inert]')).toBeNull();
  });

  it('closes with Escape and with the close callback of the detail component', () => {
    open();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(opener());
    fireEvent.click(screen.getByRole('button', { name: 'Fertig' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closes after 2 minutes without input and restarts the countdown on input', () => {
    open();
    act(() => void vi.advanceTimersByTime(119_000));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.pointerDown(screen.getByText('Detailinhalt'));
    act(() => void vi.advanceTimersByTime(119_000));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.keyDown(screen.getByText('Detailinhalt'), { key: 'a' });
    act(() => void vi.advanceTimersByTime(120_000));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(opener()).toHaveFocus();
  });

  it('does not close while the detail component reports a draft and closes after it is released', () => {
    open();
    fireEvent.click(screen.getByRole('button', { name: 'Entwurf' }));
    act(() => void vi.advanceTimersByTime(10 * 60_000));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Entwurf verwerfen' }));
    act(() => void vi.advanceTimersByTime(120_000));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('clears its timers when the view closes', () => {
    open();
    fireEvent.keyDown(document, { key: 'Escape' });
    const before = vi.getTimerCount();
    act(() => void vi.advanceTimersByTime(300_000));
    expect(vi.getTimerCount()).toBeLessThanOrEqual(before);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('does not open from a tap on the content and does not trigger fullscreen from the heading', () => {
    renderWithProviders(<Shell layout="tablet" registry={registry} />, context());
    fireEvent.click(screen.getByText('Kacheltext'));
    expect(screen.queryByRole('dialog')).toBeNull();
    const parentUp = vi.fn();
    document.addEventListener('pointerup', parentUp);
    fireEvent.pointerUp(opener());
    document.removeEventListener('pointerup', parentUp);
    expect(parentUp).not.toHaveBeenCalled();
  });

  it('offers no detail button on the phone', () => {
    renderWithProviders(<Shell layout="phone" registry={registry} />, context());
    expect(screen.queryByRole('button', { name: de.lists.open })).toBeNull();
  });
});
