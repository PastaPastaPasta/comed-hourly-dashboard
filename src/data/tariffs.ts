import type {
  CommonAdders,
  DfcBucket,
  DfcBucketKey,
  DfcMode,
  ResidentialClassId,
  ResidentialTariff,
  TariffOverrides,
} from '../types';
import tariffData from './tariffs.json';

export const SOURCE_LINKS = [
  {
    label: 'ComEd Hourly Pricing APIs',
    url: 'https://hourlypricing.comed.com/hp-api/',
  },
  {
    label: 'ComEd live prices',
    url: 'https://hourlypricing.comed.com/live-prices/',
  },
  {
    label: 'ComEd delivery-service charge guide, January 2026',
    url: 'https://www.comed.com/cdn/assets/v3/assets/blt3ebb3fed6084be2a/blt7904befea93c3525/695c1987487fe7e68ec05155/A_Guide_to_the_Retail_Customer_s_Billed_Delivery_Service_Charges.pdf?branch=prod_alias',
  },
  {
    label: 'ComEd residential line-item summary, January 2025',
    url: 'https://www.comed.com/cdn/assets/v3/assets/blt3ebb3fed6084be2a/blt3e0ca86b8d7fead8/679124838b9f8273f6633ade/ADA_Summary_of_Typical_Residential_Line_Item_Changes.pdf?branch=prod_alias',
  },
  {
    label: 'User bill: Res - Hourly Single - TOD, May 6-Jun 7 2026',
    url: '#bill-defaults',
  },
];

// Every number lives in tariffs.json, which is also published next to the app as
// tariffs.json for other tools (the solar compute gate). Edit values there, not here.
const timeOfDayBuckets = (dfc: Record<DfcBucketKey, number>): DfcBucket[] =>
  tariffData.timeOfDayBuckets.map((bucket) => ({
    key: bucket.key as DfcBucketKey,
    label: bucket.label,
    startHour: bucket.startHour,
    endHour: bucket.endHour,
    dollarsPerKwh: dfc[bucket.key as DfcBucketKey],
  }));

export const RESIDENTIAL_TARIFFS: ResidentialTariff[] = tariffData.residentialTariffs.map(
  (tariff) => ({
    ...tariff,
    id: tariff.id as ResidentialClassId,
    timeOfDayDfc: timeOfDayBuckets(tariff.timeOfDayDfc),
  }),
);

export const DEFAULT_COMMON_ADDERS: CommonAdders = { ...tariffData.commonAdders };

export const COMMON_ADDER_KEYS = Object.keys(DEFAULT_COMMON_ADDERS) as Array<keyof CommonAdders>;

export const DEFAULT_TARIFF_ID = tariffData.defaultTariffId as ResidentialClassId;

export function getTariff(id = DEFAULT_TARIFF_ID): ResidentialTariff {
  return RESIDENTIAL_TARIFFS.find((tariff) => tariff.id === id) ?? RESIDENTIAL_TARIFFS[0];
}

export function createDefaultOverrides(id = DEFAULT_TARIFF_ID): TariffOverrides {
  const tariff = getTariff(id);
  return {
    residentialClassId: tariff.id,
    dfcMode: tariffData.defaultDfcMode as DfcMode,
    standardDfc: tariff.standardDfc,
    timeOfDayDfc: tariff.timeOfDayDfc.reduce(
      (result, bucket) => ({ ...result, [bucket.key]: bucket.dollarsPerKwh }),
      {} as TariffOverrides['timeOfDayDfc'],
    ),
    commonAdders: { ...DEFAULT_COMMON_ADDERS },
  };
}
