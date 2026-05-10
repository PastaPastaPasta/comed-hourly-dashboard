import { beforeEach, describe, expect, it } from 'vitest';
import { loadOverrides, saveOverrides } from './storage';

describe('storage', () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => {
          store.set(key, value);
        },
      },
    });
  });

  it('loads current bill defaults with negative carbon-free adjustment', () => {
    const overrides = loadOverrides();

    expect(overrides.commonAdders.carbonFreeResourceAdjustment).toBe(-0.06414);
    expect(overrides.commonAdders.pea).toBe(0);
  });

  it('does not persist obsolete common adder keys', () => {
    const overrides = loadOverrides();
    saveOverrides({
      ...overrides,
      commonAdders: {
        ...overrides.commonAdders,
        capacityCharge: 0.01993,
      } as typeof overrides.commonAdders,
    });

    const saved = store.get('comed-hourly-dashboard:tariff-overrides:v2');

    expect(saved).not.toContain('capacityCharge');
  });
});
