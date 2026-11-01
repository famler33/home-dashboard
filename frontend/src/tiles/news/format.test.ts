import { describe, expect, it } from 'vitest';
import { describeAge } from './format';
import { newsNow } from './test-data';

const ago = (seconds: number) => new Date(newsNow - seconds * 1000).toISOString();
const describeAt = (seconds: number) => describeAge(ago(seconds), newsNow, 'de', 'Europe/Berlin');

// Covers: FR-5, AC-14, AC-15
describe('describeAge', () => {
  it('says "just now" under 15 seconds, also for dates slightly in the future', () => {
    expect(describeAt(5)).toEqual({ kind: 'justNow' });
    expect(describeAt(-30)).toEqual({ kind: 'justNow' });
  });

  it('uses short German relative text up to 24 hours', () => {
    expect(describeAt(12 * 60)).toEqual({ kind: 'text', text: 'vor 12 Min.' });
    expect(describeAt(3 * 3600)).toEqual({ kind: 'text', text: 'vor 3 Std.' });
  });

  it('switches to a German date beyond 24 hours', () => {
    const result = describeAt(30 * 3600);
    expect(result.kind).toBe('text');
    expect('text' in result && result.text).toMatch(/^Sa\.?, 31\.10\.$/);
  });
});
