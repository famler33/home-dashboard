import type { RadarDocument } from './types';

export interface MapView {
  /** World pixel position (at the document's zoom) of the top-left corner of the view. */
  originX: number;
  originY: number;
  width: number;
  height: number;
  /** Home position inside the view, in pixels. */
  homeX: number;
  homeY: number;
}

export interface Cell {
  col: number;
  row: number;
}

export function worldPixel(
  lon: number,
  lat: number,
  zoom: number,
  tileSize: number,
): { x: number; y: number } {
  const scale = tileSize * 2 ** zoom;
  const sin = Math.sin((lat * Math.PI) / 180);
  return {
    x: ((lon + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale,
  };
}

function lonOfWorldX(x: number, scale: number): number {
  return (x / scale) * 360 - 180;
}

function latOfWorldY(y: number, scale: number): number {
  return (Math.atan(Math.sinh(Math.PI - (2 * Math.PI * y) / scale)) * 180) / Math.PI;
}

/** Parallelogram spanned by the north-west, north-east and south-west corners in a local equirectangular plane. */
function gridFrame(corners: [number, number][]) {
  const [nw, sw, , ne] = corners as [
    [number, number],
    [number, number],
    [number, number],
    [number, number],
  ];
  const k = Math.cos(((nw[1] + sw[1]) / 2) * (Math.PI / 180));
  const ax = (ne[0] - nw[0]) * k;
  const ay = ne[1] - nw[1];
  const bx = (sw[0] - nw[0]) * k;
  const by = sw[1] - nw[1];
  return { nw, k, ax, ay, bx, by, det: ax * by - ay * bx };
}

function solve(
  frame: ReturnType<typeof gridFrame>,
  lon: number,
  lat: number,
): { s: number; t: number } {
  const px = (lon - frame.nw[0]) * frame.k;
  const py = lat - frame.nw[1];
  return {
    s: (px * frame.by - py * frame.bx) / frame.det,
    t: (frame.ax * py - frame.ay * px) / frame.det,
  };
}

export function cellAt(doc: RadarDocument, lon: number, lat: number): Cell | undefined {
  const frame = gridFrame(doc.corners);
  if (frame.det === 0) return undefined;
  const { s, t } = solve(frame, lon, lat);
  if (s < 0 || s >= 1 || t < 0 || t >= 1) return undefined;
  return { col: Math.floor(s * doc.size), row: Math.floor(t * doc.size) };
}

/** A fixed-size window of the map centred on the home position. */
export function mapView(doc: RadarDocument, width = 512, height = 320): MapView {
  const home = worldPixel(doc.home.lon, doc.home.lat, doc.map.zoom, doc.map.tileSize);
  return {
    originX: home.x - width / 2,
    originY: home.y - height / 2,
    width,
    height,
    homeX: width / 2,
    homeY: height / 2,
  };
}

/** For every pixel of the view the index (row * size + col) of the radar cell below it, or -1. */
export function buildLookup(doc: RadarDocument, view: MapView): Int16Array {
  const scale = doc.map.tileSize * 2 ** doc.map.zoom;
  const frame = gridFrame(doc.corners);
  const lookup = new Int16Array(view.width * view.height).fill(-1);
  if (frame.det === 0) return lookup;

  const lons = Array.from({ length: view.width }, (_, x) =>
    lonOfWorldX(view.originX + x + 0.5, scale),
  );
  for (let y = 0; y < view.height; y += 1) {
    const lat = latOfWorldY(view.originY + y + 0.5, scale);
    const py = lat - frame.nw[1];
    for (let x = 0; x < view.width; x += 1) {
      const px = (lons[x]! - frame.nw[0]) * frame.k;
      const s = (px * frame.by - py * frame.bx) / frame.det;
      const t = (frame.ax * py - frame.ay * px) / frame.det;
      if (s < 0 || s >= 1 || t < 0 || t >= 1) continue;
      lookup[y * view.width + x] = Math.floor(t * doc.size) * doc.size + Math.floor(s * doc.size);
    }
  }
  return lookup;
}
