#!/usr/bin/env node
// Manual check of the two news feeds (not part of any gate).
// Fetches each feed once with the real source and prints only counts and shapes, never titles.
//
//   node --import tsx scripts/news-live-check.mjs
import { createNewsSource } from '../src/sources/news/news-source.ts';

for (const group of ['local', 'global']) {
  const source = createNewsSource({
    group,
    fetchImpl: fetch,
    userAgent: 'home-dashboard/live-check',
  });
  const started = Date.now();
  try {
    const payload = await source.fetch(AbortSignal.timeout(source.timeoutMs));
    const newest = payload.headlines[0];
    const ageMinutes = newest
      ? Math.round((Date.now() - Date.parse(newest.publishedAt)) / 60_000)
      : 'none';
    console.log(
      `ok   ${source.id}: ${payload.headlines.length} headlines, newest ${ageMinutes} min old, ${Date.now() - started} ms`,
    );
  } catch (error) {
    console.log(`FAIL ${source.id}: ${error instanceof Error ? error.name : 'error'}`);
    process.exitCode = 1;
  }
}
