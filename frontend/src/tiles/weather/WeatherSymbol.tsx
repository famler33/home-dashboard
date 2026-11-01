import { symbolKind, type ConditionId, type SymbolKind } from './conditions';

interface Props {
  condition: ConditionId;
  isDay: boolean;
  /** Accessible name; the symbol is decorative (hidden from assistive technology) without it. */
  label?: string;
  className?: string;
}

const CLOUD = 'M18 46h28a9 9 0 0 0 1.5-17.9A13 13 0 0 0 22.4 26 10.5 10.5 0 0 0 18 46z';

function Sun({ scale = 1, x = 0, y = 0 }: { scale?: number; x?: number; y?: number }) {
  return (
    <g className="symbol-sun" transform={`translate(${x} ${y}) scale(${scale})`}>
      <circle cx="32" cy="32" r="11" className="fill-warn" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
        <line
          key={angle}
          x1="32"
          y1="12"
          x2="32"
          y2="17"
          transform={`rotate(${angle} 32 32)`}
          className="stroke-warn"
          strokeWidth="3"
          strokeLinecap="round"
        />
      ))}
    </g>
  );
}

function Moon({ scale = 1, x = 0, y = 0 }: { scale?: number; x?: number; y?: number }) {
  return (
    <g className="symbol-moon" transform={`translate(${x} ${y}) scale(${scale})`}>
      <path d="M38 12a20 20 0 1 0 14 34A16 16 0 0 1 38 12z" className="fill-ink" />
      <circle cx="50" cy="16" r="1.6" className="fill-ink" />
      <circle cx="55" cy="26" r="1.2" className="fill-ink" />
    </g>
  );
}

function Cloud({ night, y = 0, dim = false }: { night: boolean; y?: number; dim?: boolean }) {
  return (
    <g className="symbol-cloud" transform={`translate(0 ${y})`}>
      <path
        d={CLOUD}
        className={`fill-ink-muted ${night ? 'opacity-80' : ''} ${dim ? 'opacity-60' : ''}`}
      />
    </g>
  );
}

function Stars({ night }: { night: boolean }) {
  if (!night) return null;
  return (
    <>
      <circle cx="12" cy="12" r="1.6" className="fill-ink" />
      <circle cx="52" cy="14" r="1.3" className="fill-ink" />
    </>
  );
}

function body(kind: SymbolKind, night: boolean) {
  switch (kind) {
    case 'clear':
      return night ? <Moon /> : <Sun />;
    case 'partly-cloudy':
      return (
        <>
          {night ? <Moon scale={0.7} x={-2} y={-4} /> : <Sun scale={0.7} x={-4} y={-6} />}
          <Cloud night={night} y={4} />
        </>
      );
    case 'overcast':
      return (
        <>
          <g transform="translate(8 -6) scale(0.8)">
            <Cloud night={night} dim />
          </g>
          <Cloud night={night} y={4} />
          <Stars night={night} />
        </>
      );
    case 'fog':
      return (
        <>
          <Cloud night={night} y={-4} />
          <g className="symbol-fog stroke-ink-muted" strokeWidth="3" strokeLinecap="round">
            <line x1="16" y1="46" x2="48" y2="46" />
            <line x1="12" y1="53" x2="44" y2="53" />
            <line x1="20" y1="60" x2="52" y2="60" />
          </g>
          <Stars night={night} />
        </>
      );
    case 'rain':
      return (
        <>
          <Cloud night={night} y={-6} />
          <g className="symbol-drops stroke-accent" strokeWidth="3" strokeLinecap="round">
            <line x1="24" y1="46" x2="21" y2="54" />
            <line x1="33" y1="46" x2="30" y2="54" />
            <line x1="42" y1="46" x2="39" y2="54" />
          </g>
          <Stars night={night} />
        </>
      );
    case 'thunderstorm':
      return (
        <>
          <Cloud night={night} y={-6} />
          <polygon
            className="symbol-bolt fill-warn"
            points="34,38 26,52 32,52 29,62 41,46 34,46 38,38"
          />
          <Stars night={night} />
        </>
      );
    case 'snow':
      return (
        <>
          <Cloud night={night} y={-6} />
          <g className="symbol-flakes fill-ink">
            <circle cx="24" cy="50" r="2.6" />
            <circle cx="33" cy="56" r="2.6" />
            <circle cx="42" cy="50" r="2.6" />
          </g>
          <Stars night={night} />
        </>
      );
    default:
      return (
        <>
          <circle
            cx="32"
            cy="32"
            r="18"
            fill="none"
            className="stroke-ink-muted"
            strokeWidth="3"
            strokeDasharray="4 5"
          />
          <line
            x1="24"
            y1="32"
            x2="40"
            y2="32"
            className="stroke-ink-muted"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </>
      );
  }
}

export function WeatherSymbol({ condition, isDay, label, className }: Props) {
  const kind = symbolKind(condition);
  return (
    <svg
      viewBox="0 0 64 64"
      data-symbol={kind}
      data-variant={isDay ? 'day' : 'night'}
      className={className ?? 'h-[1.6em] w-[1.6em]'}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    >
      {body(kind, !isDay)}
    </svg>
  );
}
