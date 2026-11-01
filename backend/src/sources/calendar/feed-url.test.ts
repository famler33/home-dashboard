import { describe, expect, it } from 'vitest';
import { FeedRejected, isAllowedHost, normaliseFeedUrl } from './feed-url.js';

// Covers: FR-9, NFR-3, AC-29, AC-30
describe('feed url', () => {
  it('rewrites webcal to https', () => {
    expect(normaliseFeedUrl('webcal://p12-caldav.icloud.com/published/2/abc').protocol).toBe(
      'https:',
    );
  });

  it('accepts calendar.google.com and icloud.com subdomains', () => {
    expect(() =>
      normaliseFeedUrl('https://calendar.google.com/calendar/ical/a/private-x/basic.ics'),
    ).not.toThrow();
    expect(() => normaliseFeedUrl('https://p12-caldav.icloud.com/published/2/abc')).not.toThrow();
    expect(() => normaliseFeedUrl('https://icloud.com/x')).not.toThrow();
  });

  it('rejects look-alike hosts on the dot boundary', () => {
    expect(isAllowedHost('evilicloud.com')).toBe(false);
    expect(isAllowedHost('icloud.com.evil.example')).toBe(false);
    expect(isAllowedHost('notcalendar.google.com')).toBe(false);
    expect(isAllowedHost('p1.icloud.com')).toBe(true);
  });

  it('rejects userinfo, ports, IP literals and plain http', () => {
    const bad = [
      'https://user:pw@calendar.google.com/x',
      'https://calendar.google.com:8443/x',
      'https://127.0.0.1/x',
      'https://[::1]/x',
      'http://calendar.google.com/x',
      'ftp://calendar.google.com/x',
      'not a url',
    ];
    for (const url of bad) expect(() => normaliseFeedUrl(url), url).toThrow(FeedRejected);
  });

  it('rejects a host outside the allow-list without echoing it', () => {
    try {
      normaliseFeedUrl('https://example.org/secret-token-123');
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(FeedRejected);
      expect((error as FeedRejected).reason).toBe('host');
      expect((error as Error).message).not.toContain('example.org');
      expect((error as Error).message).not.toContain('secret-token-123');
    }
  });
});
