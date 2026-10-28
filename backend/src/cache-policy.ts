/**
 * Every API response is `no-store` except these routes, which set their own header:
 * the radar document (revalidated with an ETag) and the basemap tiles (cached by the browser).
 */
export const cacheableApiRoutes: readonly string[] = [
  '/api/v1/weather/radar',
  '/api/v1/weather/basemap/',
];

export function isCacheableApiRoute(url: string): boolean {
  const path = url.split('?')[0] ?? url;
  return cacheableApiRoutes.some((route) =>
    route.endsWith('/') ? path.startsWith(route) : path === route,
  );
}
