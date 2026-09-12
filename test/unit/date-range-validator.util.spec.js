'use strict';

const { DateRangeValidator } = require('../../src/common/utils/date-range-validator.util');

describe('DateRangeValidator (Unit)', () => {
  it('correctly identifies overlapping date intervals', () => {
    const rangeA = { start: '2026-06-01', end: '2026-06-10' };
    const rangeB = { start: '2026-06-05', end: '2026-06-15' };
    expect(DateRangeValidator.isOverlap(rangeA, rangeB)).toBe(true);
  });

  it('correctly identifies non-overlapping intervals', () => {
    const rangeA = { start: '2026-06-01', end: '2026-06-04' };
    const rangeB = { start: '2026-06-05', end: '2026-06-10' };
    expect(DateRangeValidator.isOverlap(rangeA, rangeB)).toBe(false);
  });

  it('calculates business days excluding weekends and holidays', () => {
    // 2026-06-01 is Monday, 2026-06-05 is Friday = 5 business days
    const days = DateRangeValidator.countBusinessDays(
      '2026-06-01T00:00:00Z',
      '2026-06-05T00:00:00Z',
      ['2026-06-03']
    );
    expect(days).toBe(4);
  });
});
