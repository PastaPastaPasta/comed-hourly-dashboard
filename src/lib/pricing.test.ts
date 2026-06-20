import { describe, expect, it } from 'vitest';
import { createDefaultOverrides } from '../data/tariffs';
import { calculateFullPrice, findDfcBucket, mergePricePoints, serviceHourForHourEnding } from './pricing';
import { centralWallTimeToUtcMs } from './time';

const overrides = createDefaultOverrides('single-no-heat');
const buckets = [
  { key: 'morning' as const, label: 'Morning', startHour: 6, endHour: 13, dollarsPerKwh: 0.04475 },
  {
    key: 'middayPeak' as const,
    label: 'Mid-Day Peak',
    startHour: 13,
    endHour: 19,
    dollarsPerKwh: 0.11852,
  },
  { key: 'evening' as const, label: 'Evening', startHour: 19, endHour: 21, dollarsPerKwh: 0.04185 },
  {
    key: 'overnight' as const,
    label: 'Overnight',
    startHour: 21,
    endHour: 6,
    dollarsPerKwh: 0.03345,
  },
];

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
    expect(points[0].dfc).toBeCloseTo(4.475);
    expect(points[0].fullActual).toBeCloseTo(2 + 4.475 + 1.074 + 0.128 + 0.818695);
  });

  it('adds sample bill DFC values into the full variable price', () => {
    const result = calculateFullPrice(2, centralDate(14), overrides);

    expect(result.dfc).toBeCloseTo(11.852);
    expect(result.transmission).toBeCloseTo(1.074);
    expect(result.ridersAndTaxes).toBeCloseTo(0.818695);
    expect(result.total).toBeCloseTo(15.872695);
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
    expect(multi.timeOfDayDfc.middayPeak).toBeCloseTo(0.095);
    expect(multi.commonAdders.transmission).toBeCloseTo(overrides.commonAdders.transmission);
    expect(multi.commonAdders.pea).toBeCloseTo(-0.00191104);
  });
});
