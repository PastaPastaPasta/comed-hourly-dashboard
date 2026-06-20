import type { CommonAdders, DfcBucket, ResidentialTariff, TariffOverrides } from '../types';

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

const buckets = (
  morning: number,
  middayPeak: number,
  evening: number,
  overnight: number,
): DfcBucket[] => [
  {
    key: 'morning',
    label: 'Morning',
    startHour: 6,
    endHour: 13,
    dollarsPerKwh: morning,
  },
  {
    key: 'middayPeak',
    label: 'Mid-Day Peak',
    startHour: 13,
    endHour: 19,
    dollarsPerKwh: middayPeak,
  },
  {
    key: 'evening',
    label: 'Evening',
    startHour: 19,
    endHour: 21,
    dollarsPerKwh: evening,
  },
  {
    key: 'overnight',
    label: 'Overnight',
    startHour: 21,
    endHour: 6,
    dollarsPerKwh: overnight,
  },
];

export const RESIDENTIAL_TARIFFS: ResidentialTariff[] = [
  {
    id: 'single-no-heat',
    label: 'Single family, no electric heat',
    description: 'Residential single-family delivery class without electric space heat.',
    customerCharge: 15.5,
    standardMeteringCharge: 3.87,
    standardDfc: 0.06228,
    iedt: 0.00128,
    timeOfDayDfc: buckets(0.04475, 0.11852, 0.04185, 0.03345),
  },
  {
    id: 'multi-no-heat',
    label: 'Multi family, no electric heat',
    description: 'Residential multi-family delivery class without electric space heat.',
    customerCharge: 11.51,
    standardMeteringCharge: 3.82,
    standardDfc: 0.04791,
    iedt: 0.00126,
    timeOfDayDfc: buckets(0.034, 0.095, 0.03164, 0.02359),
  },
  {
    id: 'single-heat',
    label: 'Single family, electric heat',
    description: 'Residential single-family delivery class with electric space heat.',
    customerCharge: 18.18,
    standardMeteringCharge: 4.03,
    standardDfc: 0.03165,
    iedt: 0.00134,
    timeOfDayDfc: buckets(0.0235, 0.0616, 0.02225, 0.01836),
  },
  {
    id: 'multi-heat',
    label: 'Multi family, electric heat',
    description: 'Residential multi-family delivery class with electric space heat.',
    customerCharge: 12.95,
    standardMeteringCharge: 4.01,
    standardDfc: 0.02996,
    iedt: 0.00133,
    timeOfDayDfc: buckets(0.02254, 0.05729, 0.02138, 0.01785),
  },
];

export const DEFAULT_COMMON_ADDERS: CommonAdders = {
  transmission: 0.01074,
  miscProcurementComponents: 0.00134,
  pea: -0.00191104,
  energyEfficiency: 0.00369,
  environmentalCostRecovery: 0.00009,
  renewablePortfolioStandard: 0.00516,
  coalToSolarEnergyStorage: 0.00009,
  carbonFreeResourceAdjustment: -0.01344,
  zeroEmissionStandard: 0.00087,
  energyTransitionAssistance: 0.00084,
  lowIncomeDiscountRecovery: 0.00111203,
  franchiseCost: 0.00076606,
  stateTax: 0.00330313,
  municipalTax: 0.00627677,
  miscellaneous: 0,
};

export const COMMON_ADDER_KEYS = Object.keys(DEFAULT_COMMON_ADDERS) as Array<keyof CommonAdders>;

export const DEFAULT_TARIFF_ID = 'single-no-heat';

export function getTariff(id = DEFAULT_TARIFF_ID): ResidentialTariff {
  return RESIDENTIAL_TARIFFS.find((tariff) => tariff.id === id) ?? RESIDENTIAL_TARIFFS[0];
}

export function createDefaultOverrides(id = DEFAULT_TARIFF_ID): TariffOverrides {
  const tariff = getTariff(id);
  return {
    residentialClassId: tariff.id,
    dfcMode: 'timeOfDay',
    standardDfc: tariff.standardDfc,
    timeOfDayDfc: tariff.timeOfDayDfc.reduce(
      (result, bucket) => ({ ...result, [bucket.key]: bucket.dollarsPerKwh }),
      {} as TariffOverrides['timeOfDayDfc'],
    ),
    commonAdders: { ...DEFAULT_COMMON_ADDERS },
  };
}
