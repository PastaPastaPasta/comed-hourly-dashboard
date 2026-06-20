export type PricePoint = {
  at: number;
  supplyCents: number | null;
  kind: 'actual' | 'dayAhead' | 'fiveMinute';
};

export type DfcBucketKey = 'morning' | 'middayPeak' | 'evening' | 'overnight';

export type ResidentialClassId =
  | 'single-no-heat'
  | 'multi-no-heat'
  | 'single-heat'
  | 'multi-heat';

export type DfcMode = 'standard' | 'timeOfDay';

export type DfcBucket = {
  key: DfcBucketKey;
  label: string;
  startHour: number;
  endHour: number;
  dollarsPerKwh: number;
};

export type ResidentialTariff = {
  id: ResidentialClassId;
  label: string;
  description: string;
  customerCharge: number;
  standardMeteringCharge: number;
  standardDfc: number;
  iedt: number;
  timeOfDayDfc: DfcBucket[];
};

export type CommonAdders = {
  transmission: number;
  miscProcurementComponents: number;
  pea: number;
  energyEfficiency: number;
  environmentalCostRecovery: number;
  renewablePortfolioStandard: number;
  coalToSolarEnergyStorage: number;
  carbonFreeResourceAdjustment: number;
  zeroEmissionStandard: number;
  energyTransitionAssistance: number;
  lowIncomeDiscountRecovery: number;
  franchiseCost: number;
  stateTax: number;
  municipalTax: number;
  miscellaneous: number;
};

export type TariffOverrides = {
  residentialClassId: ResidentialClassId;
  dfcMode: DfcMode;
  standardDfc: number;
  timeOfDayDfc: Record<DfcBucketKey, number>;
  commonAdders: CommonAdders;
};

export type PriceBreakdown = {
  supply: number;
  dfc: number;
  transmission: number;
  iedt: number;
  ridersAndTaxes: number;
  total: number;
};

export type DashboardPoint = PriceBreakdown & {
  at: number;
  label: string;
  dateLabel: string;
  bucketLabel: string;
  actualSupply: number | null;
  dayAheadSupply: number | null;
  fullActual: number | null;
  fullDayAhead: number | null;
};

export type RangeKey = 'today' | 'tomorrow' | 'week' | 'month';
