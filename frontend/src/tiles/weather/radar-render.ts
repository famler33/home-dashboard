import type { RadarDocument } from './types';

const MM_PER_HOUR_PER_UNIT = 0.12; // one raw unit = 0.01 mm per 5 minutes

/** Intensity breakpoints in mm/h with their RGBA colour (alpha encodes intensity too). */
const breakpoints: { mmPerHour: number; rgba: [number, number, number, number] }[] = [
  { mmPerHour: 0.1, rgba: [155, 212, 255, 140] },
  { mmPerHour: 0.5, rgba: [74, 144, 255, 165] },
  { mmPerHour: 1, rgba: [63, 191, 107, 180] },
  { mmPerHour: 2.5, rgba: [245, 211, 63, 190] },
  { mmPerHour: 5, rgba: [245, 139, 42, 205] },
  { mmPerHour: 10, rgba: [229, 52, 43, 220] },
  { mmPerHour: 20, rgba: [193, 31, 166, 230] },
];

/** ImageData is little-endian RGBA: pack as 0xAABBGGRR. */
const pack = ([r, g, b, a]: [number, number, number, number]): number =>
  ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;

let cachedRamp: Uint32Array | undefined;

export function intensityRamp(): Uint32Array {
  if (cachedRamp) return cachedRamp;
  const ramp = new Uint32Array(256);
  for (let value = 1; value < 256; value += 1) {
    const mm = value * MM_PER_HOUR_PER_UNIT;
    const bucket = [...breakpoints].reverse().find((entry) => mm >= entry.mmPerHour);
    ramp[value] = bucket ? pack(bucket.rgba) : 0;
  }
  cachedRamp = ramp;
  return ramp;
}

export const intensityLegend: { mmPerHour: number; colour: number }[] = breakpoints.map(
  (entry) => ({
    mmPerHour: entry.mmPerHour,
    colour: intensityRamp()[Math.ceil(entry.mmPerHour / MM_PER_HOUR_PER_UNIT)] ?? 0,
  }),
);

export function legendCss(colour: number): string {
  const r = colour & 255;
  const g = (colour >>> 8) & 255;
  const b = (colour >>> 16) & 255;
  const a = ((colour >>> 24) & 255) / 255;
  return `rgba(${r}, ${g}, ${b}, ${a.toFixed(2)})`;
}

export interface DecodedFrame {
  time: string;
  kind: 'observed' | 'forecast';
  bytes: Uint8Array;
}

export function decodeFrames(doc: RadarDocument): DecodedFrame[] {
  return doc.frames.map((frame) => {
    const binary = atob(frame.values);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return { time: frame.time, kind: frame.kind, bytes };
  });
}

/** Writes the pixels of one frame; `lookup` maps each pixel to a radar cell or -1. */
export function renderFrame(
  bytes: Uint8Array,
  lookup: Int16Array,
  ramp: Uint32Array,
  out: Uint32Array,
): void {
  for (let index = 0; index < lookup.length; index += 1) {
    const cell = lookup[index]!;
    out[index] = cell < 0 ? 0 : ramp[bytes[cell]!]!;
  }
}
