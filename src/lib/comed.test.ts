import { describe, expect, it } from 'vitest';
import { parseComedDateUtcSeries } from './comed';
import { formatCentralDateTime } from './time';

describe('parseComedDateUtcSeries', () => {
  it('parses ComEd Date.UTC array literals without eval', () => {
    const points = parseComedDateUtcSeries(
      '[[Date.UTC(2026,4,9,0,0,0), 2.1], [Date.UTC(2026,4,9,1,0,0), -0.4]]',
      'actual',
    );

    expect(points).toHaveLength(2);
    expect(points[0].supplyCents).toBe(2.1);
    expect(points[1].supplyCents).toBe(-0.4);
    expect(formatCentralDateTime(points[0].at)).toContain('12:00 AM');
  });

  it('rejects unexpected script-like input', () => {
    expect(() => parseComedDateUtcSeries('alert(1)', 'actual')).toThrow(
      'Unexpected ComEd series format',
    );
  });
});
