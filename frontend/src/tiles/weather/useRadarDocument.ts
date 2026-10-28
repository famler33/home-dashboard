import { useEffect, useState } from 'react';
import { decodeFrames, type DecodedFrame } from './radar-render';
import { isRadarDocument, type RadarDocument } from './types';

export interface RadarDocumentState {
  status: 'idle' | 'loading' | 'ready' | 'unavailable';
  doc: RadarDocument | null;
  frames: DecodedFrame[];
}

interface Options {
  /** Version announced by the snapshot; a change triggers a reload. */
  version: string | undefined;
  enabled: boolean;
  fetchImpl?: typeof fetch;
}

interface Outcome {
  kind: 'pending' | 'ready' | 'unavailable';
  doc: RadarDocument | null;
  frames: DecodedFrame[];
}

/** Loads the radar document while the radar is visible and its version changes; keeps the previous one meanwhile. */
export function useRadarDocument({
  version,
  enabled,
  fetchImpl = fetch,
}: Options): RadarDocumentState {
  const [outcome, setOutcome] = useState<Outcome>({ kind: 'pending', doc: null, frames: [] });

  useEffect(() => {
    if (!enabled || version === undefined) return undefined;
    const controller = new AbortController();

    fetchImpl('/api/v1/weather/radar', { cache: 'no-cache', signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('radar unavailable');
        const body: unknown = await response.json();
        if (!isRadarDocument(body)) throw new Error('radar document invalid');
        if (!controller.signal.aborted) {
          setOutcome({ kind: 'ready', doc: body, frames: decodeFrames(body) });
        }
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setOutcome((previous) =>
          previous.doc ? previous : { kind: 'unavailable', doc: null, frames: [] },
        );
      });

    return () => controller.abort();
  }, [version, enabled, fetchImpl]);

  if (!enabled) return { status: 'idle', doc: outcome.doc, frames: outcome.frames };
  return {
    status: outcome.kind === 'pending' ? 'loading' : outcome.kind,
    doc: outcome.doc,
    frames: outcome.frames,
  };
}
