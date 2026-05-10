import type { PricePoint } from '../types';
import { centralWallTimeToUtcMs, ymd } from './time';

const ORIGIN = 'https://hourlypricing.comed.com';

type ComedFeedPoint = {
  millisUTC: string;
  price: string;
};

const dateUtcPattern =
  /\[\s*Date\.UTC\(\s*(\d{4})\s*,\s*(\d{1,2})\s*,\s*(\d{1,2})\s*,\s*(\d{1,2})\s*,\s*(\d{1,2})\s*,\s*(\d{1,2})\s*\)\s*,\s*(-?\d+(?:\.\d+)?)\s*\]/g;

export function parseComedDateUtcSeries(source: string, kind: PricePoint['kind']): PricePoint[] {
  const points: PricePoint[] = [];
  const trimmed = source.trim();
  if (!trimmed.startsWith('[') || !trimmed.endsWith(']')) {
    throw new Error('Unexpected ComEd series format');
  }

  for (const match of trimmed.matchAll(dateUtcPattern)) {
    const [, year, monthIndex, day, hour, minute, second, price] = match;
    points.push({
      at: centralWallTimeToUtcMs(
        Number(year),
        Number(monthIndex),
        Number(day),
        Number(hour),
        Number(minute),
        Number(second),
      ),
      supplyCents: Number(price),
      kind,
    });
  }

  if (points.length === 0 && trimmed !== '[]') {
    throw new Error('No ComEd series points found');
  }

  return points.sort((a, b) => a.at - b.at);
}

async function fetchText(url: string, signal?: AbortSignal): Promise<string> {
  const response = await fetch(url, { signal, cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`ComEd request failed: ${response.status}`);
  }
  return response.text();
}

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal, cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`ComEd request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export async function fetchDayActual(date: Date, signal?: AbortSignal): Promise<PricePoint[]> {
  const text = await fetchText(`${ORIGIN}/api?type=day&date=${ymd(date)}`, signal);
  return parseComedDateUtcSeries(text, 'actual');
}

export async function fetchDayAhead(date: Date, signal?: AbortSignal): Promise<PricePoint[]> {
  const text = await fetchText(`${ORIGIN}/api?type=daynexttoday&date=${ymd(date)}`, signal);
  return parseComedDateUtcSeries(text, 'dayAhead');
}

export async function fetchCurrentHourAverage(signal?: AbortSignal): Promise<number | null> {
  const payload = await fetchJson<Array<{ price?: string }>>(
    `${ORIGIN}/api?type=currenthouraverage`,
    signal,
  );
  const price = Number(payload[0]?.price);
  return Number.isFinite(price) ? price : null;
}

export async function fetchFiveMinuteFeed(signal?: AbortSignal): Promise<PricePoint[]> {
  const payload = await fetchJson<ComedFeedPoint[]>(`${ORIGIN}/api?type=5minutefeed`, signal);
  return payload
    .map((point) => ({
      at: Number(point.millisUTC),
      supplyCents: Number(point.price),
      kind: 'fiveMinute' as const,
    }))
    .filter((point) => Number.isFinite(point.at) && Number.isFinite(point.supplyCents))
    .sort((a, b) => a.at - b.at);
}

export async function fetchRangePrices(
  dates: Date[],
  includeDayAhead: boolean,
  signal?: AbortSignal,
): Promise<{ actual: PricePoint[]; dayAhead: PricePoint[] }> {
  const actualResults = await Promise.allSettled(dates.map((date) => fetchDayActual(date, signal)));
  const dayAheadResults = includeDayAhead
    ? await Promise.allSettled(dates.map((date) => fetchDayAhead(date, signal)))
    : [];

  return {
    actual: actualResults.flatMap((result) => (result.status === 'fulfilled' ? result.value : [])),
    dayAhead: dayAheadResults.flatMap((result) =>
      result.status === 'fulfilled' ? result.value : [],
    ),
  };
}
