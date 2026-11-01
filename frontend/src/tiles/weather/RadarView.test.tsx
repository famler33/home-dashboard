import { act, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { de } from '../../i18n/de';
import { i18n } from '../../i18n';
import { sourceFixture } from '../../test-fixtures';
import { mockMatchMedia } from '../../test-utils';
import { installCanvasMock, type CanvasMock } from './canvas-mock';
import { RadarView } from './RadarView';
import { radarDocumentFixture, weatherNow, weatherSource } from './test-data';

let mock: CanvasMock;
const doc = radarDocumentFixture();
const okFetch = () =>
  vi.fn(async () => new Response(JSON.stringify(doc))) as unknown as typeof fetch;
const radarEntry = weatherSource('weather-radar');

beforeEach(() => {
  mock = installCanvasMock();
  vi.useFakeTimers({ now: weatherNow, toFake: ['setTimeout', 'clearTimeout', 'Date'] });
});

afterEach(() => {
  mock.restore();
});

function show(props: Partial<Parameters<typeof RadarView>[0]> = {}) {
  return render(
    <I18nextProvider i18n={i18n}>
      <RadarView
        radar={{ ...radarEntry, data: { ...(radarEntry.data as object), version: doc.version } }}
        radarAgeSeconds={30}
        layout="wall"
        active
        night={false}
        timeZone="Europe/Berlin"
        fetchImpl={okFetch()}
        {...props}
      />
    </I18nextProvider>,
  );
}

const flush = async () => {
  // fake timers are active, so waitFor cannot poll: let the pending promises settle explicitly
  for (let round = 0; round < 5; round += 1) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
  }
};

// Covers: FR-7, AC-16, AC-17, AC-18, AC-19, AC-20, AC-21, AC-37
describe('RadarView', () => {
  it('shows the map, the credit and the legend once the document is loaded', async () => {
    show();
    await flush();
    expect(screen.getByRole('img', { name: de.weather.radar.canvas })).toBeInTheDocument();
    expect(screen.getByText(de.weather.credit.radar)).toBeInTheDocument();
    expect(screen.getByLabelText(de.weather.radar.legend)).toBeInTheDocument();
  });

  it('labels the current frame with its time and observed or forecast as text', async () => {
    show();
    await flush();
    expect(screen.getByTestId('frame-label')).toBeInTheDocument();
    // frame 2 is the newest observed frame (13:40Z = 14:40 Berlin)
    expect(screen.getByTestId('frame-label')).toHaveTextContent('14:40 Uhr · Beobachtung');
  });

  it('steps through the frames and labels forecast frames as Vorhersage', async () => {
    show();
    await flush();
    expect(screen.getByTestId('frame-label')).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(450);
    });
    expect(screen.getByTestId('frame-label')).toHaveTextContent('Vorhersage');
  });

  it('shows one frame and runs no loop timer under reduced motion', async () => {
    mockMatchMedia((query) => query.includes('prefers-reduced-motion'));
    show();
    await flush();
    expect(screen.getByTestId('frame-label')).toBeInTheDocument();
    const before = screen.getByTestId('frame-label').textContent;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(screen.getByTestId('frame-label').textContent).toBe(before);
  });

  it('does not fetch or run timers while inactive', async () => {
    const fetchImpl = okFetch();
    show({ active: false, fetchImpl });
    await flush();
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('shows a calm loading state while the radar has not loaded yet', () => {
    show({
      radar: sourceFixture({
        id: 'weather-radar',
        status: 'never-loaded',
        data: null,
        ageSeconds: null,
        lastUpdated: null,
      }),
    });
    expect(screen.getByText(de.weather.radar.loading)).toBeInTheDocument();
  });

  it('shows the unavailable state for a failed radar source and for a missing document', async () => {
    const { unmount } = show({
      radar: sourceFixture({
        id: 'weather-radar',
        status: 'error',
        data: null,
        ageSeconds: null,
        lastUpdated: null,
        lastErrorCode: 'SOURCE_FETCH_FAILED',
      }),
    });
    expect(screen.getByText(de.weather.radar.unavailable)).toBeInTheDocument();
    unmount();
    show({
      fetchImpl: vi.fn(async () => new Response('{}', { status: 404 })) as unknown as typeof fetch,
    });
    await flush();
    expect(screen.getByText(de.weather.radar.unavailable)).toBeInTheDocument();
  });

  it('labels a stale radar as Veraltet with its age and keeps showing the last picture', async () => {
    show({
      radar: {
        ...radarEntry,
        status: 'stale',
        data: { ...(radarEntry.data as object), version: doc.version },
      },
      radarAgeSeconds: 780,
    });
    await flush();
    expect(screen.getByTestId('frame-label')).toBeInTheDocument();
    expect(screen.getByText(/Radar veraltet/)).toHaveTextContent('vor 13 Min.');
  });

  it('loads a new document only when the version changes', async () => {
    const fetchImpl = okFetch();
    const { rerender } = show({ fetchImpl });
    await flush();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    rerender(
      <I18nextProvider i18n={i18n}>
        <RadarView
          radar={{ ...radarEntry, data: { ...(radarEntry.data as object), version: 'newer' } }}
          radarAgeSeconds={10}
          layout="wall"
          active
          night={false}
          timeZone="Europe/Berlin"
          fetchImpl={fetchImpl}
        />
      </I18nextProvider>,
    );
    await flush();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
