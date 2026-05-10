# ComEd Hourly Dashboard

Dashboard for ComEd residential hourly pricing. It graphs ComEd real-time and day-ahead hourly prices, then overlays an estimated full variable cents/kWh price using editable residential tariff adders.

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

Tariff defaults are curated from ComEd residential delivery documents and a user-provided Res - Hourly Single - TOD bill for Apr 7-May 6 2026. Every per-kWh component is editable because ComEd rates and bill-specific adjustments can change.

Fixed monthly customer, metering, and capacity charges are intentionally not included in the default hourly graph because they are not marginal hourly kWh costs. Purchased Electricity Adjustment defaults to 0 because it varies month to month and is assumed to average out over time.
