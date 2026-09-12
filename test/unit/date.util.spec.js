'use strict';

const {
  calculateDaysRequested,
  isNotInPast,
  datesOverlap,
  isStale,
  calculateWorkingDays,
} = require('../../src/common/utils/date.util');

describe('DateUtil (Unit)', () => {
  describe('calculateDaysRequested', () => {
    it('calculates inclusive calendar days', () => {
      expect(calculateDaysRequested('2026-09-15', '2026-09-17')).toBe(3);
      expect(calculateDaysRequested('2026-09-15', '2026-09-15')).toBe(1);
    });
  });

  describe('isNotInPast', () => {
    it('returns true for future dates', () => {
      expect(isNotInPast('2099-01-01')).toBe(true);
    });

    it('returns false for past dates', () => {
      expect(isNotInPast('2020-01-01')).toBe(false);
    });
  });

  describe('datesOverlap', () => {
    it('detects overlapping ranges', () => {
      expect(datesOverlap('2026-09-10', '2026-09-15', '2026-09-12', '2026-09-18')).toBe(true);
      expect(datesOverlap('2026-09-10', '2026-09-15', '2026-09-15', '2026-09-20')).toBe(true);
    });

    it('returns false for disjoint ranges', () => {
      expect(datesOverlap('2026-09-10', '2026-09-14', '2026-09-15', '2026-09-20')).toBe(false);
    });
  });

  describe('isStale', () => {
    it('returns true if timestamp is missing or expired', () => {
      expect(isStale(null, 1000)).toBe(true);
      expect(isStale(new Date(Date.now() - 5000).toISOString(), 1000)).toBe(true);
    });

    it('returns false for fresh timestamps', () => {
      expect(isStale(new Date().toISOString(), 60000)).toBe(false);
    });
  });

  describe('calculateWorkingDays', () => {
    it('excludes weekends by default (Saturday & Sunday)', () => {
      // 2026-09-14 is Monday, 2026-09-18 is Friday (5 working days)
      expect(calculateWorkingDays('2026-09-14', '2026-09-18')).toBe(5);
      // 2026-09-14 to 2026-09-20 (7 calendar days, 5 working days)
      expect(calculateWorkingDays('2026-09-14', '2026-09-20')).toBe(5);
    });

    it('excludes public holidays when provided', () => {
      const holidays = ['2026-09-15', '2026-09-16'];
      expect(calculateWorkingDays('2026-09-14', '2026-09-18', [0, 6], holidays)).toBe(3);
    });

    it('supports custom weekend schedules (e.g. Friday-Saturday)', () => {
      // Friday (5) and Saturday (6) are weekends
      expect(calculateWorkingDays('2026-09-17', '2026-09-20', [5, 6])).toBe(2);
    });
  });
});
