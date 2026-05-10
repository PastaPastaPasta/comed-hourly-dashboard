import { getTariff } from '../data/tariffs';
import type {
  CommonAdders,
  DashboardPoint,
  DfcBucket,
  DfcBucketKey,
  PriceBreakdown,
  PricePoint,
  TariffOverrides,
} from '../types';
import { centralDateParts, formatCentralDate, formatCentralHour } from './time';

const dollarsToCents = (value: number) => value * 100;

export function findDfcBucket(date: Date, buckets: DfcBucket[]): DfcBucket {
  const hour = centralDateParts(date).hour;
  const bucket = buckets.find((candidate) => {
    if (candidate.startHour < candidate.endHour) {
      return hour >= candidate.startHour && hour < candidate.endHour;
    }
    return hour >= candidate.startHour || hour < candidate.endHour;
  });

  return bucket ?? buckets[0];
}

export function commonAddersTotal(adders: CommonAdders): number {
  return Object.values(adders).reduce((sum, value) => sum + value, 0);
}

export function getDfcDollars(date: Date, overrides: TariffOverrides): {
  bucketKey: DfcBucketKey;
  bucketLabel: string;
  dollarsPerKwh: number;
} {
  const tariff = getTariff(overrides.residentialClassId);
  if (overrides.dfcMode === 'standard') {
    return {
      bucketKey: 'morning',
      bucketLabel: 'Standard',
      dollarsPerKwh: overrides.standardDfc,
    };
  }

  const bucket = findDfcBucket(date, tariff.timeOfDayDfc);
  return {
    bucketKey: bucket.key,
    bucketLabel: bucket.label,
    dollarsPerKwh: overrides.timeOfDayDfc[bucket.key],
  };
}

export function calculateFullPrice(
  supplyCents: number,
  date: Date,
  overrides: TariffOverrides,
): PriceBreakdown & { bucketLabel: string } {
  const tariff = getTariff(overrides.residentialClassId);
  const dfc = getDfcDollars(date, overrides);
  const transmission = dollarsToCents(overrides.commonAdders.transmission);
  const iedt = dollarsToCents(tariff.iedt);
  const riderDollars = commonAddersTotal({
    ...overrides.commonAdders,
    transmission: 0,
  });
  const ridersAndTaxes = dollarsToCents(riderDollars);

  return {
    supply: supplyCents,
    dfc: dollarsToCents(dfc.dollarsPerKwh),
    transmission,
    iedt,
    ridersAndTaxes,
    total: supplyCents + dollarsToCents(dfc.dollarsPerKwh) + transmission + iedt + ridersAndTaxes,
    bucketLabel: dfc.bucketLabel,
  };
}

export function mergePricePoints(
  actual: PricePoint[],
  dayAhead: PricePoint[],
  overrides: TariffOverrides,
): DashboardPoint[] {
  const timestamps = new Set<number>();
  actual.forEach((point) => timestamps.add(point.at));
  dayAhead.forEach((point) => timestamps.add(point.at));

  const actualByTime = new Map(actual.map((point) => [point.at, point.supplyCents]));
  const dayAheadByTime = new Map(dayAhead.map((point) => [point.at, point.supplyCents]));

  return Array.from(timestamps)
    .sort((a, b) => a - b)
    .map((at) => {
      const date = new Date(at);
      const actualSupply = actualByTime.get(at) ?? null;
      const dayAheadSupply = dayAheadByTime.get(at) ?? null;
      const supplyForBreakdown = actualSupply ?? dayAheadSupply ?? 0;
      const breakdown = calculateFullPrice(supplyForBreakdown, date, overrides);
      const actualFull =
        actualSupply === null ? null : calculateFullPrice(actualSupply, date, overrides).total;
      const dayAheadFull =
        dayAheadSupply === null ? null : calculateFullPrice(dayAheadSupply, date, overrides).total;

      return {
        ...breakdown,
        at,
        label: formatCentralHour(at),
        dateLabel: formatCentralDate(at),
        actualSupply,
        dayAheadSupply,
        fullActual: actualFull,
        fullDayAhead: dayAheadFull,
      };
    });
}

export function average(values: Array<number | null | undefined>): number | null {
  const finite = values.filter((value): value is number => Number.isFinite(value));
  if (!finite.length) return null;
  return finite.reduce((sum, value) => sum + value, 0) / finite.length;
}
