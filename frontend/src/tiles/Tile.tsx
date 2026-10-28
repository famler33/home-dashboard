import { useTranslation } from 'react-i18next';
import { deriveTileStatus } from '../snapshot/freshness';
import { effectiveAgeSeconds } from '../snapshot/freshness';
import { useSnapshot } from '../snapshot/useSnapshot';
import { TileBoundary } from './TileBoundary';
import { TileFrame } from './TileFrame';
import type { TileDefinition } from './types';

interface Props {
  definition: TileDefinition;
  index: number;
}

const neverEmpty = (): boolean => false;

function ConnectedTile({ definition, index }: Props) {
  const { t } = useTranslation();
  const { snapshot, receivedAtMonotonic, nowMono } = useSnapshot();
  const { Component, sourceId } = definition;

  if (sourceId === undefined) {
    const title = definition.heading?.(null, t) ?? t(definition.titleKey);
    return (
      <TileFrame title={title} status="fresh" ageSeconds={null} index={index}>
        <Component data={null} />
      </TileFrame>
    );
  }

  const source = snapshot?.sources.find((entry) => entry.id === sourceId);
  const title = definition.heading?.(source?.data ?? null, t) ?? t(definition.titleKey);
  const status = deriveTileStatus({
    source,
    snapshotPresent: snapshot !== null,
    receivedAt: receivedAtMonotonic,
    nowMono,
    isEmpty: definition.isEmpty ?? neverEmpty,
  });
  const age =
    source && receivedAtMonotonic !== null
      ? effectiveAgeSeconds(source, receivedAtMonotonic, nowMono)
      : (source?.ageSeconds ?? null);

  return (
    <TileFrame
      title={title}
      status={status}
      ageSeconds={age}
      index={index}
      stateTexts={definition.stateTexts}
    >
      <Component data={source?.data ?? null} />
    </TileFrame>
  );
}

export function Tile({ definition, index }: Props) {
  const { t } = useTranslation();
  return (
    <TileBoundary
      fallback={
        <TileFrame
          title={t(definition.titleKey)}
          status="crashed"
          ageSeconds={null}
          index={index}
        />
      }
    >
      <ConnectedTile definition={definition} index={index} />
    </TileBoundary>
  );
}
