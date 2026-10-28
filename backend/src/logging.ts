export const redactPaths: string[] = [
  'req.headers.authorization',
  'req.headers.cookie',
  '*.credentials',
  '*.password',
  '*.token',
  '*.apiKey',
  '*.feedUrl',
  '*.calendarUrl',
];

export interface LogOptions {
  level?: string;
  stream?: NodeJS.WritableStream;
}
