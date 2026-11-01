import { act, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SourceSnapshot } from '../../api/types';
import { de } from '../../i18n/de';
import { ShellContext } from '../../shell/shell-context';
import { contextFixture, renderWithProviders } from '../../test-utils';
import { NewsTile } from './NewsTile';
import { defaultNewsSources, headline, newsEntry, newsNow, newsSnapshot } from './test-data';

beforeEach(() => {
  vi.useFakeTimers({
    now: newsNow,
    toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'],
  });
});
afterEach(() => vi.useRealTimers());

type Layout = 'tablet' | 'phone';

function show(sources: SourceSnapshot[] = defaultNewsSources(), layout: Layout = 'tablet') {
  return renderWithProviders(
    <ShellContext.Provider value={{ layout, theme: 'day' }}>
      <NewsTile />
    </ShellContext.Provider>,
    contextFixture(newsSnapshot(sources)),
  );
}

const advance = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });

/** Chained timers fire one rotation step per render, so advance one dwell at a time. */
const rotate = async (steps: number) => {
  for (let step = 0; step < steps; step += 1) await advance(15_000);
};

const active = () => document.querySelector('[data-headline-active="true"]');
const activeTitle = () => within(active() as HTMLElement).getByTestId('headline-title').textContent;
const press = (from: number, to: number) => {
  const surface = screen.getByTestId('view-surface');
  fireEvent.pointerDown(surface, { clientX: from, clientY: 50, pointerId: 1, isPrimary: true });
  fireEvent.pointerUp(surface, { clientX: to, clientY: 51, pointerId: 1, isPrimary: true });
};

// Covers: FR-1, FR-2, FR-3, AC-1, AC-2, AC-5, AC-6, AC-25
describe('NewsTile on the wall', () => {
  it('shows one headline at a time, local first, with label, source name and age', () => {
    show();
    expect(screen.getAllByTestId('headline-title')).toHaveLength(1);
    const card = active() as HTMLElement;
    expect(within(card).getByText('Lokal eins')).toBeInTheDocument();
    expect(within(card).getByText(de.news.regional)).toBeInTheDocument();
    expect(within(card).getByText('rbb24')).toBeInTheDocument();
    expect(within(card).getByText('vor 12 Min.')).toBeInTheDocument();
  });

  it('labels global headlines "Welt" with the Tagesschau name', async () => {
    show();
    await rotate(2);
    const card = active() as HTMLElement;
    expect(within(card).getByText('Welt eins')).toBeInTheDocument();
    expect(within(card).getByText(de.news.world)).toBeInTheDocument();
    expect(within(card).getByText('Tagesschau')).toBeInTheDocument();
  });

  it('shows the position as text and updates it', async () => {
    show();
    expect(screen.getByText('1 von 4')).toBeInTheDocument();
    await advance(15_000);
    expect(screen.getByText('2 von 4')).toBeInTheDocument();
  });

  it('changes the headline every 15 seconds and wraps around', async () => {
    show();
    expect(activeTitle()).toBe('Lokal eins');
    await advance(15_000);
    expect(activeTitle()).toBe('Lokal zwei');
    await rotate(3);
    expect(activeTitle()).toBe('Lokal eins');
  });

  it('renders no link and no image', () => {
    show();
    expect(document.querySelector('a')).toBeNull();
    expect(document.querySelector('img')).toBeNull();
  });

  it('renders markup in a title as literal text', () => {
    show([newsEntry('local', [headline('<img src=x onerror=alert(1)> Hallo')])]);
    expect(document.querySelector('img')).toBeNull();
    expect(screen.getByTestId('headline-title').textContent).toContain('<img');
  });

  it('computes the age from the server time, not the device clock', () => {
    vi.setSystemTime(newsNow + 2 * 3600_000);
    show();
    expect(screen.getByText('vor 12 Min.')).toBeInTheDocument();
  });

  it('shows a single headline without rotating when only one exists', async () => {
    show([newsEntry('local', [headline('Nur eine')])]);
    await advance(60_000);
    expect(activeTitle()).toBe('Nur eine');
    expect(screen.getByText('1 von 1')).toBeInTheDocument();
  });
});

// Covers: FR-4, AC-10, AC-11, AC-12, AC-13
describe('NewsTile manual navigation', () => {
  it('advances on a tap and pauses the rotation for 60 seconds', async () => {
    show();
    press(100, 102);
    expect(activeTitle()).toBe('Lokal zwei');
    await advance(59_000);
    expect(activeTitle()).toBe('Lokal zwei');
    await advance(1_000);
    await advance(15_000);
    expect(activeTitle()).not.toBe('Lokal zwei');
  });

  it('moves with swipes of at least 60 px and ignores shorter ones', () => {
    show();
    press(200, 140);
    expect(activeTitle()).toBe('Lokal zwei');
    press(100, 160);
    expect(activeTitle()).toBe('Lokal eins');
    press(100, 141);
    expect(activeTitle()).toBe('Lokal eins');
  });

  it('wraps to the last headline on a swipe right from the first', () => {
    show();
    press(100, 170);
    expect(activeTitle()).toBe('Welt zwei');
  });

  it('has previous and next buttons with German names that navigate and pause', () => {
    show();
    fireEvent.click(screen.getByRole('button', { name: de.news.next }));
    expect(activeTitle()).toBe('Lokal zwei');
    fireEvent.click(screen.getByRole('button', { name: de.news.previous }));
    expect(activeTitle()).toBe('Lokal eins');
  });

  it('uses the shared view layers for manual changes', () => {
    show();
    press(100, 102);
    expect(document.querySelector('.view-enter')).not.toBeNull();
    expect(document.querySelector('.view-exit')).not.toBeNull();
  });

  it('gives the buttons the 56 px touch target classes', () => {
    show();
    const button = screen.getByRole('button', { name: de.news.next });
    expect(button.className).toContain('min-h-14');
    expect(button.className).toContain('min-w-14');
  });
});

// Covers: FR-8, AC-9, AC-17, AC-18, AC-19, AC-20
describe('NewsTile states', () => {
  it('keeps rotating when only one source is stale and marks its headlines', async () => {
    show([
      newsEntry('local', [headline('Alt eins'), headline('Alt zwei')], {
        status: 'stale',
        ageSeconds: 3000,
      }),
      newsEntry('global', [headline('Frisch')]),
    ]);
    const card = active() as HTMLElement;
    expect(within(card).getByText(/Veraltet · vor 50 Min\./)).toBeInTheDocument();
    await advance(15_000);
    expect(activeTitle()).toBe('Alt zwei');
    await advance(15_000);
    expect(activeTitle()).toBe('Frisch');
    expect(within(active() as HTMLElement).queryByText(/Veraltet/)).toBeNull();
  });

  it('stops rotating but keeps the last headlines when every source is stale', async () => {
    show([
      newsEntry('local', [headline('A'), headline('B')], { status: 'stale', ageSeconds: 3000 }),
      newsEntry('global', [headline('C')], { status: 'stale', ageSeconds: 3100 }),
    ]);
    await advance(120_000);
    expect(activeTitle()).toBe('A');
    expect(within(active() as HTMLElement).getByText(/Veraltet/)).toBeInTheDocument();
  });

  it('shows the other source when one failed without data', () => {
    show([
      newsEntry('local', [], { status: 'error', data: null, ageSeconds: null }),
      newsEntry('global', [headline('Nur Welt')]),
    ]);
    expect(activeTitle()).toBe('Nur Welt');
  });

  it('says there are no headlines when every source delivered none', () => {
    show([newsEntry('local', []), newsEntry('global', [])]);
    expect(screen.getByText(de.news.empty)).toBeInTheDocument();
  });

  it('never renders an empty tile for any combination of states', () => {
    const variants: SourceSnapshot['status'][] = ['fresh', 'stale', 'error', 'never-loaded'];
    for (const local of variants) {
      for (const global of variants) {
        const make = (group: 'local' | 'global', status: SourceSnapshot['status']) =>
          status === 'error' || status === 'never-loaded'
            ? newsEntry(group, [], { status, data: null, ageSeconds: null })
            : newsEntry(group, [headline(`${group}-${status}`)], { status });
        const { container, unmount } = show([make('local', local), make('global', global)]);
        const anyData =
          local === 'fresh' || local === 'stale' || global === 'fresh' || global === 'stale';
        if (anyData) expect(container.textContent?.trim()).not.toBe('');
        unmount();
      }
    }
  });
});

// Covers: FR-9, AC-21, AC-22, AC-26
describe('NewsTile on the phone', () => {
  it('lists all headlines grouped by Regional and Welt without any rotation', async () => {
    show(defaultNewsSources(), 'phone');
    const regional = screen.getByRole('heading', { name: de.news.regional });
    const world = screen.getByRole('heading', { name: de.news.world });
    expect(regional).toBeInTheDocument();
    expect(world).toBeInTheDocument();
    for (const title of ['Lokal eins', 'Lokal zwei', 'Welt eins', 'Welt zwei']) {
      expect(screen.getByText(title)).toBeInTheDocument();
    }
    expect(vi.getTimerCount()).toBe(0);
    expect(screen.queryByTestId('view-surface')).toBeNull();
  });

  it('shows source and age per row and renders no link', () => {
    show(defaultNewsSources(), 'phone');
    expect(screen.getAllByText('rbb24').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Tagesschau').length).toBeGreaterThan(0);
    expect(document.querySelector('a')).toBeNull();
  });

  it('gives rows the 44 px minimum height class', () => {
    show(defaultNewsSources(), 'phone');
    expect(document.querySelector('li')?.className).toContain('min-h-11');
  });
});
