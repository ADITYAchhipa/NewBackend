import moment from 'moment-timezone';

/**
 * Calculate booking price based on property/vehicle pricing and booking duration
 * 
 * @param {Object} listing - Property or Vehicle object with pricing info
 * @param {Date|String} startDate - Booking start date
 * @param {Date|String} endDate - Booking end date
 * @returns {Object} Price breakdown with total and calculation details
 */
export function calculateBookingPrice(listing, startDate, endDate) {
    // Normalize dates to start of day in IST
    const start = moment.tz(startDate, 'Asia/Kolkata').startOf('day');
    const end = moment.tz(endDate, 'Asia/Kolkata').startOf('day');

    // Validate dates
    if (!start.isValid() || !end.isValid()) {
        throw new Error('Invalid date format');
    }

    if (end.isBefore(start)) {
        throw new Error('End date must be after start date');
    }

    if (start.isBefore(moment().startOf('day'))) {
        throw new Error('Start date cannot be in the past');
    }

    // Calculate total days (inclusive)
    const totalDays = end.diff(start, 'days') + 1;

    if (totalDays < 1) {
        throw new Error('Booking must be at least 1 day');
    }

    // Get pricing from listing
    // Check both nested structure (price.perDay) and flat structure (pricePerDay)
    // For Property: price.perDay, price.perMonth (nested) OR pricePerDay, pricePerMonth (flat)
    // For Vehicle: pricePerDay (flat)
    const dailyRate = listing.price?.perDay || listing.price?.perNight || listing.pricePerDay || listing.pricePerNight || 0;
    const monthlyRate = listing.price?.perMonth || listing.pricePerMonth || 0;

    let totalPrice = 0;
    let monthlyPeriods = 0;
    let remainingDays = 0;
    let monthlyCharge = 0;
    let dailyCharge = 0;
    let calculationMethod = '';

    // Scenario 1: Both daily and monthly rates available
    if (dailyRate > 0 && monthlyRate > 0) {
        if (totalDays >= 30) {
            // Use monthly rate for 30-day chunks
            monthlyPeriods = Math.floor(totalDays / 30);
            remainingDays = totalDays % 30;

            monthlyCharge = monthlyPeriods * monthlyRate;
            dailyCharge = remainingDays * dailyRate;
            totalPrice = monthlyCharge + dailyCharge;

            calculationMethod = `${monthlyPeriods} month(s) + ${remainingDays} day(s)`;
        } else {
            // Less than 30 days: Compare daily rate vs monthly-derived rate
            // Choose whichever is cheaper for the user
            const dailyMethod = totalDays * dailyRate;
            const monthlyDerived = totalDays * (monthlyRate / 30);

            if (monthlyDerived < dailyMethod) {
                // Monthly-derived is cheaper
                dailyCharge = monthlyDerived;
                totalPrice = monthlyDerived;
                calculationMethod = `${totalDays} day(s) at monthly-derived rate (${monthlyRate}/30 = ₹${Math.round((monthlyRate / 30) * 100) / 100}/day)`;
            } else {
                // Daily rate is cheaper or same
                dailyCharge = dailyMethod;
                totalPrice = dailyMethod;
                calculationMethod = `${totalDays} day(s) at daily rate`;
            }
        }
    }
    // Scenario 2: Only daily rate available
    else if (dailyRate > 0) {
        dailyCharge = totalDays * dailyRate;
        totalPrice = dailyCharge;
        calculationMethod = `${totalDays} day(s) at daily rate`;
    }
    // Scenario 3: Only monthly rate available
    else if (monthlyRate > 0) {
        // Calculate effective daily rate from monthly
        const effectiveDailyRate = monthlyRate / 30;
        dailyCharge = totalDays * effectiveDailyRate;
        totalPrice = dailyCharge;
        calculationMethod = `${totalDays} day(s) at monthly-derived rate (${monthlyRate}/30)`;
    }
    // Scenario 4: No pricing available
    else {
        throw new Error('No pricing information available for this listing');
    }

    // Round to 2 decimal places
    totalPrice = Math.round(totalPrice * 100) / 100;
    monthlyCharge = Math.round(monthlyCharge * 100) / 100;
    dailyCharge = Math.round(dailyCharge * 100) / 100;

    return {
        totalPrice,
        breakdown: {
            totalDays,
            monthlyPeriods,
            remainingDays,
            monthlyCharge,
            dailyCharge,
            dailyRate,
            monthlyRate,
            calculationMethod
        },
        dates: {
            start: start.format('YYYY-MM-DD'),
            end: end.format('YYYY-MM-DD')
        }
    };
}

/**
 * Validate booking dates
 * @param {Date|String} startDate 
 * @param {Date|String} endDate 
 * @returns {Object} Validated dates
 */
export function validateBookingDates(startDate, endDate) {
    const start = moment.tz(startDate, 'Asia/Kolkata').startOf('day');
    const end = moment.tz(endDate, 'Asia/Kolkata').startOf('day');

    if (!start.isValid() || !end.isValid()) {
        throw new Error('Invalid date format. Use YYYY-MM-DD or Date object');
    }

    if (end.isBefore(start)) {
        throw new Error('End date must be on or after start date');
    }

    if (start.isBefore(moment().startOf('day'))) {
        throw new Error('Start date cannot be in the past');
    }

    const totalDays = end.diff(start, 'days') + 1;

    if (totalDays < 1) {
        throw new Error('Booking must be at least 1 day');
    }

    return {
        startDate: start.toDate(),
        endDate: end.toDate(),
        totalDays
    };
}
