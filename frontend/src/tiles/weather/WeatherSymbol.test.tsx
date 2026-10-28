import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { conditionIds, symbolKind, type ConditionId } from './conditions';
import { WeatherSymbol } from './WeatherSymbol';

const representative: ConditionId[] = [
  'clear',
  'partly-cloudy',
  'overcast',
  'rain',
  'thunderstorm',
  'snow',
  'fog',
];

const css = readFileSync(join(process.cwd(), 'src/styles/index.css'), 'utf8');

// Covers: FR-10, AC-28, AC-29, AC-30
describe('WeatherSymbol', () => {
  it.each(representative)('renders a day and a night variant for %s that differ', (condition) => {
    const day = render(<WeatherSymbol condition={condition} isDay />);
    const dayMarkup = day.container.innerHTML;
    day.unmount();
    const night = render(<WeatherSymbol condition={condition} isDay={false} />);
    expect(night.container.querySelector('[data-variant="night"]')).not.toBeNull();
    expect(dayMarkup).toContain('data-variant="day"');
    expect(night.container.innerHTML).not.toBe(dayMarkup);
  });

  it('uses the night variant when isDay is false and the day variant otherwise', () => {
    expect(
      render(<WeatherSymbol condition="clear" isDay={false} />).container.querySelector('svg'),
    ).toHaveAttribute('data-variant', 'night');
    expect(
      render(<WeatherSymbol condition="clear" isDay />).container.querySelector('svg'),
    ).toHaveAttribute('data-variant', 'day');
  });

  it('marks the symbol kind and renders something for every condition id', () => {
    for (const condition of conditionIds) {
      const { container, unmount } = render(<WeatherSymbol condition={condition} isDay />);
      expect(container.querySelector('svg')).toHaveAttribute('data-symbol', symbolKind(condition));
      expect(container.querySelector('svg')!.children.length).toBeGreaterThan(0);
      unmount();
    }
  });

  it('is an image with an accessible name when a label is given and hidden otherwise', () => {
    const labelled = render(<WeatherSymbol condition="rain" isDay label="Regen" />);
    expect(labelled.container.querySelector('svg')).toHaveAttribute('role', 'img');
    expect(labelled.container.querySelector('svg')).toHaveAttribute('aria-label', 'Regen');
    labelled.unmount();
    const decorative = render(<WeatherSymbol condition="rain" isDay />);
    expect(decorative.container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('gives animated parts a symbol motion class', () => {
    const { container } = render(<WeatherSymbol condition="partly-cloudy" isDay />);
    expect(container.querySelectorAll('[class*="symbol-"]').length).toBeGreaterThan(0);
  });
});

describe('symbol motion styles', () => {
  const symbolRules = [...css.matchAll(/\.(symbol-[a-z-]+)\s*\{([^}]*)\}/g)].filter(
    ([, , body]) => !/animation:\s*none/.test(body ?? ''),
  );

  it('defines the symbol animations', () => {
    expect(symbolRules.length).toBeGreaterThanOrEqual(4);
  });

  it('makes every symbol animation at least 6 seconds long (slower than one change every three seconds)', () => {
    for (const [, name, body] of symbolRules) {
      const duration = /animation:\s*[a-z-]+\s+([\d.]+)s/.exec(body ?? '');
      expect(duration, name).not.toBeNull();
      expect(Number(duration![1]), name).toBeGreaterThanOrEqual(6);
    }
  });

  it('animates only transform and opacity in the symbol keyframes', () => {
    const frames = [
      ...css.matchAll(/@keyframes\s+(symbol-[a-z-]+)\s*\{((?:[^{}]|\{[^{}]*\})*)\}/g),
    ];
    expect(frames.length).toBeGreaterThanOrEqual(3);
    for (const [, name, body] of frames) {
      const properties = [...(body ?? '').matchAll(/([a-z-]+)\s*:/g)].map((match) => match[1]);
      for (const property of properties)
        expect(['transform', 'opacity'], `${name}: ${property}`).toContain(property);
    }
  });

  it('turns the symbol animations off under reduced motion', () => {
    const reduced = /@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n {2}\}/.exec(
      css.slice(css.indexOf('symbol-')),
    );
    expect(css).toMatch(/prefers-reduced-motion: reduce[\s\S]*\.symbol-[\s\S]*animation:\s*none/);
    expect(reduced).not.toBeNull();
  });
});
