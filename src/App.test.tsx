import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import App from './App';

vi.mock('./lib/comed', () => ({
  fetchCurrentHourAverage: vi.fn(async () => 2.5),
  fetchFiveMinuteFeed: vi.fn(async () => [{ at: Date.now(), supplyCents: 2.5, kind: 'fiveMinute' }]),
  fetchRangePrices: vi.fn(async () => ({
    actual: [
      { at: Date.now(), supplyCents: 2.5, kind: 'actual' },
      { at: Date.now() + 3600000, supplyCents: -0.2, kind: 'actual' },
    ],
    dayAhead: [{ at: Date.now() + 7200000, supplyCents: 3.1, kind: 'dayAhead' }],
  })),
}));

describe('App', () => {
  it('renders the dashboard controls and pricing table', async () => {
    render(<App />);

    expect(await screen.findByText('Full variable electricity price')).toBeInTheDocument();
    expect(screen.getByLabelText('Dashboard controls')).toBeInTheDocument();
    expect(screen.getByText('Tariff model')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Best charging windows' })).toBeInTheDocument();
    expect(await screen.findByText('Hour-beginning table')).toBeInTheDocument();
  });
});
