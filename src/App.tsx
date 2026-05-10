import { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Activity,
  BarChart3,
  CalendarDays,
  CircleDollarSign,
  Download,
  RefreshCw,
  RotateCcw,
  Settings2,
  Zap,
} from 'lucide-react';
import './App.css';
import { RESIDENTIAL_TARIFFS, SOURCE_LINKS, createDefaultOverrides, getTariff } from './data/tariffs';
import { fetchCurrentHourAverage, fetchFiveMinuteFeed, fetchRangePrices } from './lib/comed';
import { average, calculateFullPrice, mergePricePoints } from './lib/pricing';
import { dateRangeForKey, formatCentralDateTime } from './lib/time';
import { loadOverrides, saveOverrides } from './lib/storage';
import type {
  CommonAdders,
  DashboardPoint,
  DfcBucketKey,
  RangeKey,
  ResidentialClassId,
  TariffOverrides,
} from './types';

const rangeOptions: Array<{ key: RangeKey; label: string }> = [
  { key: 'today', label: 'Today' },
  { key: 'tomorrow', label: 'Tomorrow' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
];

const adderLabels: Record<keyof CommonAdders, string> = {
  transmission: 'Transmission',
  miscProcurementComponents: 'Misc procurement',
  pea: 'Purchased electricity adj.',
  energyEfficiency: 'Energy efficiency',
  environmentalCostRecovery: 'Environmental recovery',
  renewablePortfolioStandard: 'Renewable portfolio',
  coalToSolarEnergyStorage: 'Coal to solar/storage',
  carbonFreeResourceAdjustment: 'Carbon-free resource',
  zeroEmissionStandard: 'Zero emission standard',
  energyTransitionAssistance: 'Energy transition',
  franchiseCost: 'Franchise cost',
  stateTax: 'State tax',
  municipalTax: 'Municipal tax',
  miscellaneous: 'Miscellaneous',
};

const cents = (value: number | null | undefined, digits = 2) =>
  value !== null && value !== undefined && Number.isFinite(value)
    ? `${value.toFixed(digits)}¢`
    : 'n/a';

const dollars = (value: number) => value.toFixed(5);
const HOUR_MS = 60 * 60 * 1000;

type ChargingWindow = {
  durationHours: number;
  startAt: number;
  endAt: number;
  averageCents: number;
  minCents: number;
  maxCents: number;
};

const expectedFullPrice = (point: DashboardPoint) => point.fullActual ?? point.fullDayAhead;

function findBestChargingWindow(
  points: DashboardPoint[],
  referenceTime: number,
  durationHours: number,
): ChargingWindow | null {
  const future = points
    .filter((point) => point.at - HOUR_MS >= referenceTime && expectedFullPrice(point) !== null)
    .sort((a, b) => a.at - b.at);

  let best: ChargingWindow | null = null;

  for (let index = 0; index <= future.length - durationHours; index += 1) {
    const windowPoints = future.slice(index, index + durationHours);
    const isContiguous = windowPoints.every((point, pointIndex) => {
      if (pointIndex === 0) return true;
      return point.at - windowPoints[pointIndex - 1].at === HOUR_MS;
    });
    if (!isContiguous) continue;

    const prices = windowPoints.map((point) => expectedFullPrice(point)).filter((value): value is number => value !== null);
    if (prices.length !== durationHours) continue;

    const averageCents = average(prices);
    if (averageCents === null) continue;

    const candidate = {
      durationHours,
      startAt: windowPoints[0].at - HOUR_MS,
      endAt: windowPoints[windowPoints.length - 1].at,
      averageCents,
      minCents: Math.min(...prices),
      maxCents: Math.max(...prices),
    };

    if (!best || candidate.averageCents < best.averageCents) {
      best = candidate;
    }
  }

  return best;
}

function formatWindow(window: ChargingWindow): string {
  return `${formatCentralDateTime(window.startAt)}-${formatCentralDateTime(window.endAt)}`;
}

function App() {
  const [range, setRange] = useState<RangeKey>('today');
  const [showSupplyOnly, setShowSupplyOnly] = useState(false);
  const [showSettings, setShowSettings] = useState(true);
  const [overrides, setOverrides] = useState<TariffOverrides>(() => loadOverrides());
  const [points, setPoints] = useState<DashboardPoint[]>([]);
  const [fiveMinuteCount, setFiveMinuteCount] = useState(0);
  const [currentHourAverage, setCurrentHourAverage] = useState<number | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<DashboardPoint | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const tariff = getTariff(overrides.residentialClassId);

  useEffect(() => {
    saveOverrides(overrides);
  }, [overrides]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setRefreshKey((value) => value + 1);
    }, 5 * 60 * 1000);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const dates = dateRangeForKey(range);
    setStatus('loading');
    setError(null);

    Promise.all([
      fetchRangePrices(dates, range === 'today' || range === 'tomorrow', controller.signal),
      fetchCurrentHourAverage(controller.signal).catch(() => null),
      fetchFiveMinuteFeed(controller.signal).catch(() => []),
    ])
      .then(([prices, hourAverage, fiveMinute]) => {
        const merged = mergePricePoints(prices.actual, prices.dayAhead, overrides);
        setPoints(merged);
        setSelectedPoint((previous) =>
          merged.find((point) => point.at === previous?.at) ??
          merged.find((point) => point.actualSupply !== null || point.dayAheadSupply !== null) ??
          merged[0] ??
          null,
        );
        setCurrentHourAverage(hourAverage);
        setFiveMinuteCount(fiveMinute.length);
        setUpdatedAt(Date.now());
        setStatus('idle');
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setStatus('error');
        setError(reason instanceof Error ? reason.message : 'Could not load ComEd data.');
      });

    return () => controller.abort();
  }, [range, refreshKey, overrides]);

  const activePoint = selectedPoint ?? points.find((point) => point.actualSupply !== null) ?? points[0] ?? null;
  const nowBreakdown = useMemo(() => {
    if (currentHourAverage === null) return null;
    return calculateFullPrice(currentHourAverage, new Date(), overrides);
  }, [currentHourAverage, overrides]);

  const fullAverage = average(points.map((point) => point.fullActual ?? point.fullDayAhead));
  const referenceTime = updatedAt ?? 0;
  const upcoming = points.filter(
    (point) => point.at >= referenceTime && (point.fullActual ?? point.fullDayAhead) !== null,
  );
  const cheapest = upcoming.reduce<DashboardPoint | null>((best, point) => {
    const value = point.fullActual ?? point.fullDayAhead;
    const bestValue = best ? (best.fullActual ?? best.fullDayAhead) : null;
    return bestValue === null || (value !== null && value < bestValue) ? point : best;
  }, null);
  const highest = upcoming.reduce<DashboardPoint | null>((best, point) => {
    const value = point.fullActual ?? point.fullDayAhead;
    const bestValue = best ? (best.fullActual ?? best.fullDayAhead) : null;
    return bestValue === null || (value !== null && value > bestValue) ? point : best;
  }, null);
  const chargingWindows = [1, 2, 3]
    .map((hours) => findBestChargingWindow(points, referenceTime, hours))
    .filter((window): window is ChargingWindow => window !== null);
  const highlightedWindow =
    chargingWindows.find((window) => window.durationHours === 3) ?? chargingWindows.at(-1) ?? null;

  const updateClass = (id: ResidentialClassId) => {
    const defaults = createDefaultOverrides(id);
    setOverrides((current) => ({
      ...defaults,
      dfcMode: current.dfcMode,
      commonAdders: current.commonAdders,
    }));
  };

  const updateAdder = (key: keyof CommonAdders, value: number) => {
    setOverrides((current) => ({
      ...current,
      commonAdders: { ...current.commonAdders, [key]: value },
    }));
  };

  const updateBucket = (key: DfcBucketKey, value: number) => {
    setOverrides((current) => ({
      ...current,
      timeOfDayDfc: { ...current.timeOfDayDfc, [key]: value },
    }));
  };

  const resetTariff = () => setOverrides(createDefaultOverrides(overrides.residentialClassId));

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">ComEd residential hourly pricing</p>
          <h1>Full variable electricity price</h1>
        </div>
        <div className="top-actions">
          <button className="icon-button" type="button" onClick={() => setShowSettings((value) => !value)} title="Tariff settings">
            <Settings2 size={18} />
          </button>
          <button className="icon-button" type="button" onClick={() => setRefreshKey((value) => value + 1)} title="Refresh data">
            <RefreshCw size={18} className={status === 'loading' ? 'spin' : ''} />
          </button>
        </div>
      </header>

      <section className="kpis" aria-label="Price summary">
        <Kpi icon={<Zap size={18} />} label="Current supply" value={cents(currentHourAverage)} />
        <Kpi icon={<CircleDollarSign size={18} />} label="Current full variable" value={cents(nowBreakdown?.total)} />
        <Kpi icon={<Activity size={18} />} label="Range average" value={cents(fullAverage)} />
        <Kpi icon={<CalendarDays size={18} />} label="Cheapest upcoming" value={cheapest ? `${cents(cheapest.fullActual ?? cheapest.fullDayAhead)} ${formatCentralDateTime(cheapest.at)}` : 'n/a'} />
        <Kpi icon={<BarChart3 size={18} />} label="Highest upcoming" value={highest ? `${cents(highest.fullActual ?? highest.fullDayAhead)} ${formatCentralDateTime(highest.at)}` : 'n/a'} />
      </section>

      <section className="toolbar" aria-label="Dashboard controls">
        <div className="segmented">
          {rangeOptions.map((option) => (
            <button
              key={option.key}
              className={range === option.key ? 'active' : ''}
              type="button"
              onClick={() => setRange(option.key)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <label className="toggle">
          <input
            type="checkbox"
            checked={showSupplyOnly}
            onChange={(event) => setShowSupplyOnly(event.target.checked)}
          />
          Supply-only chart
        </label>
        <span className={`status ${status}`}>
          {status === 'loading' ? 'Loading live data' : status === 'error' ? 'Data issue' : `Updated ${updatedAt ? formatCentralDateTime(updatedAt) : 'n/a'}`}
        </span>
      </section>

      {error ? <div className="banner">ComEd data could not be loaded: {error}</div> : null}

      <section className="dashboard-grid">
        <section className="chart-panel" aria-label="Hourly price chart">
          <div className="section-heading">
            <div>
              <h2>Hour-ending price curve</h2>
              <p>All labels are Central hour-ending times. Full price excludes fixed monthly charges and capacity charge.</p>
            </div>
            <button className="secondary-button" type="button" onClick={() => exportCsv(points)}>
              <Download size={16} />
              CSV
            </button>
          </div>
          <section className="charging-recommendations" aria-label="Best charging windows">
            <div>
              <h3>Best charging windows</h3>
              <p>Expected full price uses real-time prices when available, otherwise day-ahead prices.</p>
            </div>
            <div className="charging-window-grid">
              {chargingWindows.length ? (
                chargingWindows.map((window) => (
                  <button
                    key={window.durationHours}
                    className={window.durationHours === highlightedWindow?.durationHours ? 'charging-window active' : 'charging-window'}
                    type="button"
                    onClick={() => {
                      const point = points.find((candidate) => candidate.at === window.endAt);
                      if (point) setSelectedPoint(point);
                    }}
                  >
                    <span>{window.durationHours}h</span>
                    <strong>{cents(window.averageCents)} avg</strong>
                    <small>{formatWindow(window)}</small>
                    <small>{cents(window.minCents)}-{cents(window.maxCents)} range</small>
                  </button>
                ))
              ) : (
                <div className="charging-empty">No future expected hours in this view.</div>
              )}
            </div>
          </section>
          <div className="chart-frame">
            {points.length ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={280}>
                <LineChart
                  data={points}
                  margin={{ top: 16, right: 24, bottom: 8, left: 0 }}
                  onMouseMove={(state) => {
                    const activeState = state as unknown as {
                      activePayload?: Array<{ payload: DashboardPoint }>;
                    };
                    if (activeState.activePayload?.[0]?.payload) {
                      setSelectedPoint(activeState.activePayload[0].payload);
                    }
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#d7dde8" />
                  <XAxis dataKey="at" tickFormatter={(value) => formatCentralDateTime(Number(value))} minTickGap={42} />
                  <YAxis unit="¢" width={48} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend />
                  {highlightedWindow ? (
                    <ReferenceArea
                      x1={highlightedWindow.startAt}
                      x2={highlightedWindow.endAt}
                      fill="#dbeafe"
                      fillOpacity={0.5}
                      stroke="#2563eb"
                      strokeOpacity={0.5}
                    />
                  ) : null}
                  <ReferenceLine y={0} stroke="#768298" strokeDasharray="4 4" />
                  <Line type="monotone" dataKey="actualSupply" name="Real-time supply" stroke="#1f6feb" strokeWidth={2} dot={false} connectNulls />
                  <Line type="monotone" dataKey="dayAheadSupply" name="Day-ahead supply" stroke="#f59e0b" strokeWidth={2} strokeDasharray="6 4" dot={false} connectNulls />
                  {!showSupplyOnly ? (
                    <Line type="monotone" dataKey="fullActual" name="Full variable" stroke="#0f8b6f" strokeWidth={3} dot={false} connectNulls />
                  ) : null}
                  {!showSupplyOnly ? (
                    <Line type="monotone" dataKey="fullDayAhead" name="Full day-ahead" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 6" dot={false} connectNulls />
                  ) : null}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-chart">Loading price curve</div>
            )}
          </div>
          <div className="component-chart">
            {points.length ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={280}>
                <AreaChart data={points} margin={{ top: 8, right: 24, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e3e7ef" />
                  <XAxis dataKey="at" hide />
                  <YAxis width={48} unit="¢" />
                  <Tooltip content={<ChartTooltip compact />} />
                  <Area type="stepAfter" dataKey="dfc" stackId="1" name="DFC" stroke="#2563eb" fill="#bfdbfe" />
                  <Area type="stepAfter" dataKey="transmission" stackId="1" name="Transmission" stroke="#9333ea" fill="#e9d5ff" />
                  <Area type="stepAfter" dataKey="iedt" stackId="1" name="IL distribution tax" stroke="#475569" fill="#cbd5e1" />
                  <Area type="stepAfter" dataKey="ridersAndTaxes" stackId="1" name="Riders/taxes" stroke="#ea580c" fill="#fed7aa" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-chart compact">Waiting for ComEd data</div>
            )}
          </div>
        </section>

        {showSettings ? (
          <aside className="settings-panel" aria-label="Tariff settings">
            <div className="section-heading compact">
              <h2>Tariff model</h2>
              <button className="icon-button" type="button" title="Reset tariff defaults" onClick={resetTariff}>
                <RotateCcw size={16} />
              </button>
            </div>

            <label>
              Residential class
              <select value={overrides.residentialClassId} onChange={(event) => updateClass(event.target.value as ResidentialClassId)}>
                {RESIDENTIAL_TARIFFS.map((item) => (
                  <option key={item.id} value={item.id}>{item.label}</option>
                ))}
              </select>
            </label>
            <p className="muted">{tariff.description}</p>

            <div className="segmented full">
              <button className={overrides.dfcMode === 'timeOfDay' ? 'active' : ''} type="button" onClick={() => setOverrides((current) => ({ ...current, dfcMode: 'timeOfDay' }))}>Time-of-day DFC</button>
              <button className={overrides.dfcMode === 'standard' ? 'active' : ''} type="button" onClick={() => setOverrides((current) => ({ ...current, dfcMode: 'standard' }))}>Standard DFC</button>
            </div>

            {overrides.dfcMode === 'standard' ? (
              <RateInput label="Standard DFC ($/kWh)" value={overrides.standardDfc} onChange={(value) => setOverrides((current) => ({ ...current, standardDfc: value }))} />
            ) : (
              <div className="rate-grid">
                {tariff.timeOfDayDfc.map((bucket) => (
                  <RateInput
                    key={bucket.key}
                    label={`${bucket.label} ($/kWh)`}
                    value={overrides.timeOfDayDfc[bucket.key]}
                    onChange={(value) => updateBucket(bucket.key, value)}
                  />
                ))}
              </div>
            )}

            <details open>
              <summary>Per-kWh adders</summary>
              <div className="rate-grid">
                {(Object.keys(overrides.commonAdders) as Array<keyof CommonAdders>).map((key) => (
                  <RateInput
                    key={key}
                    label={`${adderLabels[key]} ($/kWh)`}
                    value={overrides.commonAdders[key]}
                    onChange={(value) => updateAdder(key, value)}
                  />
                ))}
              </div>
            </details>

            <div className="note">
              Customer charge (${tariff.customerCharge.toFixed(2)}), metering charge (${tariff.standardMeteringCharge.toFixed(2)}), and capacity charge are not graphed because they are not marginal hourly kWh costs.
            </div>
          </aside>
        ) : null}
      </section>

      <section className="breakdown-grid">
        <section className="breakdown">
          <h2>Selected hour ending</h2>
          {activePoint ? (
            <>
              <div className="big-number">{cents(activePoint.total)}</div>
              <p>{formatCentralDateTime(activePoint.at)} · {activePoint.bucketLabel}</p>
              <dl>
                <BreakdownLine label="Supply" value={activePoint.supply} />
                <BreakdownLine label="DFC" value={activePoint.dfc} />
                <BreakdownLine label="Transmission" value={activePoint.transmission} />
                <BreakdownLine label="IL distribution tax" value={activePoint.iedt} />
                <BreakdownLine label="Riders/taxes/overrides" value={activePoint.ridersAndTaxes} />
              </dl>
            </>
          ) : (
            <p>No selected data point.</p>
          )}
        </section>

        <section className="table-panel">
          <h2>Hour-ending table</h2>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Hour ending</th>
                  <th>Bucket</th>
                  <th>Actual</th>
                  <th>Day-ahead</th>
                  <th>DFC</th>
                  <th>Riders</th>
                  <th>Full total</th>
                </tr>
              </thead>
              <tbody>
                {points.map((point) => (
                  <tr key={point.at} onClick={() => setSelectedPoint(point)}>
                    <td>{formatCentralDateTime(point.at)}</td>
                    <td>{point.bucketLabel}</td>
                    <td>{cents(point.actualSupply)}</td>
                    <td>{cents(point.dayAheadSupply)}</td>
                    <td>{cents(point.dfc)}</td>
                    <td>{cents(point.ridersAndTaxes + point.transmission + point.iedt)}</td>
                    <td>{cents(point.fullActual ?? point.fullDayAhead)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </section>

      <footer>
        <span>{fiveMinuteCount} five-minute observations available from the live feed.</span>
        <span>
          Sources:{' '}
          {SOURCE_LINKS.map((source, index) => (
            <a key={source.url} href={source.url} target="_blank" rel="noreferrer">
              {index > 0 ? ', ' : ''}
              {source.label}
            </a>
          ))}
        </span>
      </footer>
    </main>
  );
}

function Kpi({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="kpi">
      <div className="kpi-icon">{icon}</div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

function RateInput({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="rate-input">
      {label}
      <input
        type="number"
        value={dollars(value)}
        min="-1"
        max="1"
        step="0.00001"
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function BreakdownLine({ label, value }: { label: string; value: number }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{cents(value)}</dd>
    </>
  );
}

function ChartTooltip({
  active,
  payload,
  compact,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string; payload: DashboardPoint }>;
  compact?: boolean;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="chart-tooltip">
      <strong>{formatCentralDateTime(point.at)}</strong>
      {!compact ? <span>{point.bucketLabel}</span> : null}
      {payload
        .filter((item) => Number.isFinite(item.value))
        .map((item) => (
          <div key={item.name}>
            <i style={{ background: item.color }} />
            {item.name}: {cents(item.value)}
          </div>
        ))}
    </div>
  );
}

function exportCsv(points: DashboardPoint[]) {
  const rows = [
    ['hour_ending_central', 'bucket', 'actual_supply_cents', 'day_ahead_supply_cents', 'dfc_cents', 'transmission_cents', 'iedt_cents', 'riders_taxes_cents', 'full_actual_cents', 'full_day_ahead_cents'],
    ...points.map((point) => [
      formatCentralDateTime(point.at),
      point.bucketLabel,
      point.actualSupply ?? '',
      point.dayAheadSupply ?? '',
      point.dfc,
      point.transmission,
      point.iedt,
      point.ridersAndTaxes,
      point.fullActual ?? '',
      point.fullDayAhead ?? '',
    ]),
  ];
  const blob = new Blob([rows.map((row) => row.join(',')).join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'comed-hourly-dashboard.csv';
  link.click();
  URL.revokeObjectURL(url);
}

export default App;
