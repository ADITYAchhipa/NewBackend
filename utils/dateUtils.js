import moment from 'moment-timezone';

const TIMEZONE = 'Asia/Kolkata';

/**
 * Validate date format (YYYY-MM-DD only)
 * Throws error if invalid
 */
export function validateDateFormat(dateStr, fieldName = 'Date') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        throw new Error(`${fieldName} must be in YYYY-MM-DD format, got: ${dateStr}`);
    }

    // Ensure it's a valid calendar date
    const parsed = moment(dateStr, 'YYYY-MM-DD', true);
    if (!parsed.isValid()) {
        throw new Error(`${fieldName} is not a valid date: ${dateStr}`);
    }

    return dateStr;
}

/**
 * Normalize date to YYYY-MM-DD
 * Frontend should always send YYYY-MM-DD strings, but this handles Date objects
 */
export function normalizeDate(date) {
    if (typeof date === 'string') {
        validateDateFormat(date);
        return date;
    }
    return moment(date).tz(TIMEZONE).format('YYYY-MM-DD');
}

/**
 * Check if two date ranges overlap
 * IMPORTANT: This enforces buffer rule
 * Overlap exists if: start1 <= end2 && end1 >= start2
 * 
 * Example:
 *   Booking A: 2025-12-20 to 2025-12-23
 *   Booking B: 2025-12-24 to 2025-12-26 → NO OVERLAP (starts day after A ends)
 *   Booking C: 2025-12-23 to 2025-12-25 → OVERLAP (starts same day as A ends)
 */
export function hasRangeOverlap(start1, end1, start2, end2) {
    return start1 <= end2 && end1 >= start2;
}

/**
 * Generate array of dates for frontend calendar
 * Inclusive of both start and end
 */
export function generateDateArray(startISO, endISO) {
    const dates = [];
    let current = moment(startISO, 'YYYY-MM-DD');
    const end = moment(endISO, 'YYYY-MM-DD');

    while (current.isSameOrBefore(end, 'day')) {
        dates.push(current.format('YYYY-MM-DD'));
        current.add(1, 'day');
    }

    return dates;
}
