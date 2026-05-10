export const CENTRAL_TIME_ZONE = 'America/Chicago';

const centralFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: CENTRAL_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

export function ymd(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: CENTRAL_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(date)
    .replaceAll('-', '');
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function startOfCentralDay(date: Date): Date {
  const parts = centralDateParts(date);
  return new Date(centralWallTimeToUtcMs(parts.year, parts.month - 1, parts.day, 0, 0, 0));
}

export function dateRangeForKey(key: 'today' | 'tomorrow' | 'week' | 'month'): Date[] {
  const today = startOfCentralDay(new Date());
  const count = key === 'month' ? 30 : key === 'week' ? 7 : 1;
  const start = key === 'tomorrow' ? addDays(today, 1) : addDays(today, -(count - 1));
  return Array.from({ length: count }, (_, index) => addDays(start, index));
}

export function centralWallTimeToUtcMs(
  year: number,
  monthIndex: number,
  day: number,
  hour: number,
  minute = 0,
  second = 0,
): number {
  const utcGuess = Date.UTC(year, monthIndex, day, hour, minute, second);
  const parts = centralDateParts(new Date(utcGuess));
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return utcGuess - (asUtc - utcGuess);
}

export function centralDateParts(date: Date): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} {
  const parts = centralFormatter.formatToParts(date);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
  };
}

export function formatCentralDate(ms: number): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: CENTRAL_TIME_ZONE,
    month: 'short',
    day: 'numeric',
  }).format(new Date(ms));
}

export function formatCentralHour(ms: number): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: CENTRAL_TIME_ZONE,
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(ms));
}

export function formatCentralDateTime(ms: number): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: CENTRAL_TIME_ZONE,
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(ms));
}
