import { COMMON_ADDER_KEYS, createDefaultOverrides, getTariff } from '../data/tariffs';
import type { CommonAdders, TariffOverrides } from '../types';

const STORAGE_KEY = 'comed-hourly-dashboard:tariff-overrides:v2';

function sanitizeCommonAdders(
  defaults: CommonAdders,
  parsed?: Partial<Record<keyof CommonAdders, unknown>>,
): CommonAdders {
  return COMMON_ADDER_KEYS.reduce(
    (result, key) => {
      const value = parsed?.[key];
      return {
        ...result,
        [key]: typeof value === 'number' && Number.isFinite(value) ? value : defaults[key],
      };
    },
    { ...defaults },
  );
}

export function loadOverrides(): TariffOverrides {
  const fallback = createDefaultOverrides();
  try {
    if (typeof window.localStorage?.getItem !== 'function') return fallback;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<TariffOverrides>;
    const tariff = getTariff(parsed.residentialClassId);
    const defaults = createDefaultOverrides(tariff.id);
    return {
      ...defaults,
      ...parsed,
      residentialClassId: tariff.id,
      timeOfDayDfc: { ...defaults.timeOfDayDfc, ...parsed.timeOfDayDfc },
      commonAdders: sanitizeCommonAdders(defaults.commonAdders, parsed.commonAdders),
    };
  } catch {
    return fallback;
  }
}

export function saveOverrides(overrides: TariffOverrides): void {
  try {
    if (typeof window.localStorage?.setItem === 'function') {
      const defaults = createDefaultOverrides(overrides.residentialClassId);
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          ...overrides,
          commonAdders: sanitizeCommonAdders(defaults.commonAdders, overrides.commonAdders),
        }),
      );
    }
  } catch {
    // Storage is a convenience only; calculation should keep working if it is unavailable.
  }
}
