// controller/earningsController.js
// Earnings History Management - Daily, Monthly, Yearly tracking
import User from '../models/user.js';

/**
 * Add earnings to owner's history
 * Called when a booking is marked as completed
 * 
 * @param {string} ownerId - Owner's user ID
 * @param {number} amount - Earnings amount
 * @param {string} type - 'properties' or 'vehicles'
 */
export const addEarnings = async (ownerId, amount, type = 'properties') => {
    try {
        const user = await User.findById(ownerId);
        if (!user) {
            console.error('[Earnings] User not found:', ownerId);
            return false;
        }

        const now = new Date();
        const currentDay = now.getDate();
        const currentMonth = now.getMonth() + 1; // 1-12
        const currentYear = now.getFullYear();

        // Initialize earningsHistory if not exists
        if (!user.earningsHistory) {
            user.earningsHistory = {
                properties: {
                    daily: { data: Array(30).fill(0), lastUpdated: {} },
                    monthly: { data: Array(12).fill(0), lastUpdated: {} },
                    yearly: []
                },
                vehicles: {
                    daily: { data: Array(30).fill(0), lastUpdated: {} },
                    monthly: { data: Array(12).fill(0), lastUpdated: {} },
                    yearly: []
                }
            };
        }

        const history = user.earningsHistory[type];
        if (!history) {
            console.error('[Earnings] Invalid type:', type);
            return false;
        }

        // --- Update Daily ---
        updateDailyEarnings(history.daily, amount, currentDay, currentMonth, currentYear);

        // --- Update Monthly ---
        updateMonthlyEarnings(history.monthly, amount, currentMonth, currentYear);

        // --- Update Yearly ---
        updateYearlyEarnings(history.yearly, amount, currentYear);

        // Mark the path as modified for Mongoose
        user.markModified('earningsHistory');
        await user.save();

        console.log(`[Earnings] Added ${amount} to ${type} for owner ${ownerId}`);
        return true;
    } catch (error) {
        console.error('[Earnings] Error adding earnings:', error.message);
        return false;
    }
};

/**
 * Update daily earnings with FIFO queue logic
 */
function updateDailyEarnings(daily, amount, currentDay, currentMonth, currentYear) {
    const last = daily.lastUpdated || {};

    // First time or same day - just add to last element
    if (!last.year) {
        // First time - initialize
        daily.data = Array(30).fill(0);
        daily.data[29] = amount;
        daily.lastUpdated = { day: currentDay, month: currentMonth, year: currentYear };
        return;
    }

    // Calculate days difference
    const lastDate = new Date(last.year, last.month - 1, last.day);
    const currentDate = new Date(currentYear, currentMonth - 1, currentDay);
    const daysDiff = Math.floor((currentDate - lastDate) / (1000 * 60 * 60 * 24));

    if (daysDiff === 0) {
        // Same day - add to last element
        daily.data[29] = (daily.data[29] || 0) + amount;
    } else if (daysDiff > 0) {
        // New day(s) - shift array and add zeros for gaps
        const shifts = Math.min(daysDiff, 30); // Don't shift more than 30

        for (let i = 0; i < shifts; i++) {
            daily.data.shift();
            daily.data.push(0);
        }

        // Add amount to last element (today)
        daily.data[29] = (daily.data[29] || 0) + amount;
        daily.lastUpdated = { day: currentDay, month: currentMonth, year: currentYear };
    }
    // If daysDiff < 0, something is wrong with dates - don't update
}

/**
 * Update monthly earnings with FIFO queue logic
 */
function updateMonthlyEarnings(monthly, amount, currentMonth, currentYear) {
    const last = monthly.lastUpdated || {};

    // First time
    if (!last.year) {
        monthly.data = Array(12).fill(0);
        monthly.data[11] = amount;
        monthly.lastUpdated = { month: currentMonth, year: currentYear };
        return;
    }

    // Calculate months difference
    const monthsDiff = (currentYear - last.year) * 12 + (currentMonth - last.month);

    if (monthsDiff === 0) {
        // Same month - add to last element
        monthly.data[11] = (monthly.data[11] || 0) + amount;
    } else if (monthsDiff > 0) {
        // New month(s) - shift array and add zeros for gaps
        const shifts = Math.min(monthsDiff, 12);

        for (let i = 0; i < shifts; i++) {
            monthly.data.shift();
            monthly.data.push(0);
        }

        // Add amount to last element (current month)
        monthly.data[11] = (monthly.data[11] || 0) + amount;
        monthly.lastUpdated = { month: currentMonth, year: currentYear };
    }
}

/**
 * Update yearly earnings - dynamic array
 */
function updateYearlyEarnings(yearly, amount, currentYear) {
    const existingYear = yearly.find(y => y.year === currentYear);

    if (existingYear) {
        existingYear.earnings = (existingYear.earnings || 0) + amount;
    } else {
        yearly.push({ year: currentYear, earnings: amount });
        // Sort by year ascending
        yearly.sort((a, b) => a.year - b.year);
    }
}

/**
 * Get earnings history for display
 * GET /api/analytics/earnings-history
 */
export const getEarningsHistory = async (req, res) => {
    try {
        const userId = req.userId;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Not authenticated' });
        }

        const { period = '30D', type = 'properties' } = req.query;

        const user = await User.findById(userId).select('earningsHistory').lean();
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const history = user.earningsHistory?.[type];
        if (!history) {
            return res.json({
                success: true,
                data: [],
                labels: [],
                total: 0
            });
        }

        let data = [];
        let labels = [];
        let total = 0;

        const now = new Date();

        switch (period) {
            case '30D':
                // Daily data - last 30 days
                data = history.daily?.data || Array(30).fill(0);
                total = data.reduce((sum, val) => sum + (val || 0), 0);

                // Generate date labels (last 30 days)
                for (let i = 29; i >= 0; i--) {
                    const date = new Date(now);
                    date.setDate(date.getDate() - i);
                    labels.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
                }
                break;

            case 'Monthly':
                // Monthly data - last 12 months
                data = history.monthly?.data || Array(12).fill(0);
                total = data.reduce((sum, val) => sum + (val || 0), 0);

                // Generate month labels (last 12 months)
                for (let i = 11; i >= 0; i--) {
                    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
                    labels.push(date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }));
                }
                break;

            case 'Yearly':
                // Yearly data - all years
                const yearlyData = history.yearly || [];
                data = yearlyData.map(y => y.earnings || 0);
                labels = yearlyData.map(y => String(y.year));
                total = data.reduce((sum, val) => sum + (val || 0), 0);
                break;

            default:
                return res.status(400).json({ success: false, message: 'Invalid period' });
        }

        return res.json({
            success: true,
            data,
            labels,
            total,
            period,
            type
        });

    } catch (error) {
        console.error('[Earnings] Error fetching history:', error.message);
        return res.status(500).json({ success: false, message: error.message });
    }
};
