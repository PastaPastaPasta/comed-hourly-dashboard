# ComEd Hourly Dashboard

Dashboard for ComEd residential hourly pricing. It graphs ComEd real-time and day-ahead hourly prices, then overlays an estimated full variable cents/kWh price using editable residential tariff adders.

All chart and table timestamps are Central **hour-ending** labels. For example, `1:00 AM` means the `12:00 AM-1:00 AM` interval.

## Commands

- `npm run dev` starts the local app.
- `npm run build` typechecks and builds production assets.
- `npm test` runs unit and integration tests.
- `npm run e2e` runs Playwright layout smoke tests.
- `npm run lint` runs ESLint.

## Data Sources

The app reads CORS-enabled ComEd endpoints directly from the browser:

- `https://hourlypricing.comed.com/api?type=day&date=YYYYMMDD`
- `https://hourlypricing.comed.com/api?type=daynexttoday&date=YYYYMMDD`
- `https://hourlypricing.comed.com/api?type=5minutefeed`
- `https://hourlypricing.comed.com/api?type=currenthouraverage`

Tariff defaults are curated from ComEd residential delivery documents and a user-provided Res - Hourly Single - TOD bill for May 6-Jun 7 2026. Every per-kWh component is editable because ComEd rates and bill-specific adjustments can change.

Fixed monthly customer, metering, and capacity charges are intentionally not included in the default hourly graph because they are not marginal hourly kWh costs. Purchased Electricity Adjustment and flat bill-specific tax/fee lines are converted to cents/kWh from the latest bill and remain editable.
