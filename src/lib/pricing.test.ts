import { describe, expect, it } from 'vitest';
import { createDefaultOverrides } from '../data/tariffs';
import { calculateFullPrice, findDfcBucket } from './pricing';
import { centralWallTimeToUtcMs } from './time';

const overrides = createDefaultOverrides('single-no-heat');
const buckets = [
  { key: 'morning' as const, label: 'Morning', startHour: 6, endHour: 13, dollarsPerKwh: 0.04428 },
  {
    key: 'middayPeak' as const,
    label: 'Mid-Day Peak',
    startHour: 13,
    endHour: 19,
    dollarsPerKwh: 0.11727,
  },
  { key: 'evening' as const, label: 'Evening', startHour: 19, endHour: 21, dollarsPerKwh: 0.04142 },
  {
    key: 'overnight' as const,
    label: 'Overnight',
    startHour: 21,
    endHour: 6,
    dollarsPerKwh: 0.03311,
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

  it('adds sample bill DFC values into the full variable price', () => {
    const result = calculateFullPrice(2, centralDate(14), overrides);

    expect(result.dfc).toBeCloseTo(11.727);
    expect(result.transmission).toBeCloseTo(1.083);
    expect(result.ridersAndTaxes).toBeCloseTo(-5.1909);
    expect(result.total).toBeCloseTo(9.7451);
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
    expect(multi.commonAdders.pea).toBe(0);
  });
});
