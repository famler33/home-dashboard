/** Radar square corners as [lon, lat] in the order north-west, south-west, south-east, north-east. */
export type Corners = [[number, number], [number, number], [number, number], [number, number]];

export interface Cell {
  col: number;
  row: number;
}

/**
 * Maps a position to a cell of the radar grid. The grid (row 0 = north, column 0 = west) is
 * treated as a parallelogram spanned by the north-west, north-east and south-west corners in a
 * local equirectangular plane; at 100 km the error stays below a tenth of a cell.
 */
export function cellForLonLat(
  corners: Corners,
  size: number,
  lon: number,
  lat: number,
): Cell | undefined {
  const [nw, sw, , ne] = corners;
  const lat0 = ((nw[1] + sw[1]) / 2) * (Math.PI / 180);
  const k = Math.cos(lat0);
  const px = lon * k - nw[0] * k;
  const py = lat - nw[1];
  const ax = (ne[0] - nw[0]) * k;
  const ay = ne[1] - nw[1];
  const bx = (sw[0] - nw[0]) * k;
  const by = sw[1] - nw[1];
  const det = ax * by - ay * bx;
  if (det === 0) return undefined;
  const s = (px * by - py * bx) / det;
  const t = (ax * py - ay * px) / det;
  if (s < 0 || s >= 1 || t < 0 || t >= 1) return undefined;
  return { col: Math.floor(s * size), row: Math.floor(t * size) };
}
