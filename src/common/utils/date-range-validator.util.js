'use strict';

class DateRangeValidator {
  static isOverlap(rangeA, rangeB) {
    const startA = new Date(rangeA.start).getTime();
    const endA = new Date(rangeA.end).getTime();
    const startB = new Date(rangeB.start).getTime();
    const endB = new Date(rangeB.end).getTime();

    if (isNaN(startA) || isNaN(endA) || isNaN(startB) || isNaN(endB)) {
      throw new Error('Invalid date format provided for overlap calculation');
    }
    return startA <= endB && startB <= endA;
  }

  static countBusinessDays(startDate, endDate, holidays = []) {
    let current = new Date(startDate);
    const end = new Date(endDate);
    if (current > end) return 0;

    const holidaySet = new Set(
      holidays.map((h) => new Date(h).toISOString().slice(0, 10))
    );

    let count = 0;
    while (current <= end) {
      const day = current.getUTCDay();
      const dateStr = current.toISOString().slice(0, 10);
      if (day !== 0 && day !== 6 && !holidaySet.has(dateStr)) {
        count++;
      }
      current.setUTCDate(current.getUTCDate() + 1);
    }
    return count;
  }
}

module.exports = { DateRangeValidator };
