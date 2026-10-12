import { describe, expect, it } from 'vitest';
import tariffData from '../data/tariffs.json';
import { createDefaultOverrides, getTariff } from '../data/tariffs';
import {
  calculateFullPrice,
  commonAddersTotal,
  findDfcBucket,
  mergePricePoints,
  serviceHourForHourEnding,
} from './pricing';
import { centralWallTimeToUtcMs } from './time';

// Expectations come from tariffs.json so a tariff update needs no test edits; these tests
// check how prices are assembled, not what the current rates are.
const overrides = createDefaultOverrides('single-no-heat');
const tariff = getTariff('single-no-heat');
const buckets = tariff.timeOfDayDfc;
const dfcCents = (key: string) => 100 * buckets.find((bucket) => bucket.key === key)!.dollarsPerKwh;
const transmissionCents = 100 * tariffData.commonAdders.transmission;
const ridersCents =
  100 * (commonAddersTotal(tariffData.commonAdders) - tariffData.commonAdders.transmission);
const fixedCents = transmissionCents + 100 * tariff.iedt + ridersCents;

const centralDate = (hour: number) =>
  new Date(centralWallTimeToUtcMs(2026, 4, 9, hour, 0, 0));

describe('pricing', () => {
  it('selects time-of-day DFC buckets at boundaries', () => {
    expect(findDfcBucket(centralDate(5), buckets).key).toBe('overnight');
    expect(findDfcBucket(centralDate(6), buckets).key).toBe('morning');
    expect(findDfcBucket(centralDate(13), buckets).key).toBe('middayPeak');
    expect(findDfcBucket(centralDate(19), buckets).key).toBe('evening');
    expect(findDfcBucket(centralDate(21), buckets).key).toBe('overnight');
  });

  it('uses the service hour before the hour-ending label for delivery buckets', () => {
    expect(findDfcBucket(serviceHourForHourEnding(centralDate(6).getTime()), buckets).key).toBe('overnight');
    expect(findDfcBucket(serviceHourForHourEnding(centralDate(13).getTime()), buckets).key).toBe('morning');
    expect(findDfcBucket(serviceHourForHourEnding(centralDate(19).getTime()), buckets).key).toBe('middayPeak');
    expect(findDfcBucket(serviceHourForHourEnding(centralDate(21).getTime()), buckets).key).toBe('evening');
  });

  it('merges hour-ending supply prices with normal clock-time delivery charges', () => {
    const points = mergePricePoints(
      [{ at: centralDate(13).getTime(), supplyCents: 2, kind: 'actual' }],
      [],
      overrides,
    );

    expect(points[0].bucketLabel).toBe('Morning');
    expect(points[0].label).toBe('12:00 PM');
    expect(points[0].dfc).toBeCloseTo(dfcCents('morning'));
    expect(points[0].fullActual).toBeCloseTo(2 + dfcCents('morning') + fixedCents);
  });

  it('adds the bill DFC values into the full variable price', () => {
    const result = calculateFullPrice(2, centralDate(14), overrides);

    expect(result.dfc).toBeCloseTo(dfcCents('middayPeak'));
    expect(result.transmission).toBeCloseTo(transmissionCents);
    expect(result.ridersAndTaxes).toBeCloseTo(ridersCents);
    expect(result.total).toBeCloseTo(2 + dfcCents('middayPeak') + fixedCents);
    expect(result.bucketLabel).toBe('Mid-Day Peak');
  });

  it('allows negative supply prices to reduce the full variable price', () => {
    const positive = calculateFullPrice(2, centralDate(2), overrides);
    const negative = calculateFullPrice(-2, centralDate(2), overrides);

    expect(negative.total).toBeCloseTo(positive.total - 4);
  });

  it('resets overrides to the selected tariff defaults', () => {
    const multi = createDefaultOverrides('multi-no-heat');

    expect(multi.residentialClassId).toBe('multi-no-heat');
    const multiData = tariffData.residentialTariffs.find((t) => t.id === 'multi-no-heat')!;
    expect(multi.timeOfDayDfc).toEqual(multiData.timeOfDayDfc);
    expect(multi.commonAdders).toEqual(tariffData.commonAdders);
  });
});
