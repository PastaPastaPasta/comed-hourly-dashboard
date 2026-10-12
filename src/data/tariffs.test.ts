import { describe, expect, it } from 'vitest';
import tariffData from './tariffs.json';
import { COMMON_ADDER_KEYS, RESIDENTIAL_TARIFFS, getTariff } from './tariffs';

describe('tariffs.json', () => {
  it('covers every hour of the day with exactly one delivery bucket', () => {
    const owners = Array.from({ length: 24 }, (_, hour) =>
      tariffData.timeOfDayBuckets.filter(({ startHour, endHour }) =>
        startHour < endHour ? hour >= startHour && hour < endHour : hour >= startHour || hour < endHour,
      ),
    );
    owners.forEach((buckets) => expect(buckets).toHaveLength(1));
  });

  it('prices every bucket for every residential class', () => {
    const keys = tariffData.timeOfDayBuckets.map((bucket) => bucket.key).sort();
    tariffData.residentialTariffs.forEach((tariff) => {
      expect(Object.keys(tariff.timeOfDayDfc).sort()).toEqual(keys);
      Object.values(tariff.timeOfDayDfc).forEach((value) => expect(Number.isFinite(value)).toBe(true));
    });
    RESIDENTIAL_TARIFFS.forEach((tariff) => expect(tariff.timeOfDayDfc).toHaveLength(keys.length));
  });

  it('keeps every rate in plausible dollars per kWh', () => {
    // Catches unit slips (cents typed as dollars, a dropped zero) before Pages publishes them
    // to the dashboard and to the solar compute gate, which mines whenever a kWh is cheap.
    tariffData.residentialTariffs.forEach((tariff) => {
      [tariff.standardDfc, ...Object.values(tariff.timeOfDayDfc)].forEach((dfc) => {
        expect(dfc).toBeGreaterThan(0.005);
        expect(dfc).toBeLessThan(0.5);
      });
      expect(tariff.iedt).toBeGreaterThanOrEqual(0);
      expect(tariff.iedt).toBeLessThan(0.05);
    });
    Object.values(tariffData.commonAdders).forEach((adder) => expect(Math.abs(adder)).toBeLessThan(0.1));
  });

  it('names a default class that exists and has every common adder', () => {
    expect(getTariff(tariffData.defaultTariffId as never).id).toBe(tariffData.defaultTariffId);
    expect(['standard', 'timeOfDay']).toContain(tariffData.defaultDfcMode);
    expect(Object.keys(tariffData.commonAdders).sort()).toEqual([...COMMON_ADDER_KEYS].sort());
  });
});
