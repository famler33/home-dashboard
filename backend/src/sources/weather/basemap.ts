import type { Corners } from './radar-geo.js';

function tileXY(lon: number, lat: number, zoom: number): { x: number; y: number } {
  const n = 2 ** zoom;
  const rad = (lat * Math.PI) / 180;
  return {
    x: Math.floor(((lon + 180) / 360) * n),
    y: Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n),
  };
}

/** Tiles of one zoom level that cover the radar square, row by row. */
export function planBasemap(corners: Corners, zoom: number): { x: number; y: number }[] {
  const tiles = corners.map(([lon, lat]) => tileXY(lon, lat, zoom));
  const minX = Math.min(...tiles.map((tile) => tile.x));
  const maxX = Math.max(...tiles.map((tile) => tile.x));
  const minY = Math.min(...tiles.map((tile) => tile.y));
  const maxY = Math.max(...tiles.map((tile) => tile.y));
  const plan: { x: number; y: number }[] = [];
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) plan.push({ x, y });
  }
  return plan;
}
