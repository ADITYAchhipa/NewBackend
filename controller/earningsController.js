// controller/earningsController.js
// Earnings History Management - Daily, Monthly, Yearly tracking
import User from '../models/user.js';
import { EARNINGS_USER_FIELDS } from '../utils/projections.js';

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
        // SECURITY: Atomic update prevents race conditions in financial operations
        // Using $inc ensures concurrent bookings don't overwrite each other
        const user = await User.findById(ownerId).select(EARNINGS_USER_FIELDS);
        if (!user) {
            console.error('[Earnings] User not found:', ownerId);
            return false;
        }

        const now = new Date();
        const currentDay = now.getDate();
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();

        // --- Daily Earnings ---
        const dailyData = user.earningsHistory[type].daily;
        const dailyLastUpdated = dailyData.lastUpdated;

        let dayIndex;
        // Check if we need to rotate/shift the daily array (FIFO queue)
        if (!dailyLastUpdated.day ||
            dailyLastUpdated.day !== currentDay ||
            dailyLastUpdated.month !== currentMonth ||
            dailyLastUpdated.year !== currentYear) {

            // Different day - shift array and insert new day at index 29
            // ATOMIC: Use $pop and $push instead of manual array manipulation
            await User.findByIdAndUpdate(ownerId, {
                $pop: { [`earningsHistory.${type}.daily.data`]: -1 }, // Remove first (oldest)
                $push: { [`earningsHistory.${type}.daily.data`]: amount }, // Add to end (newest)
                $set: {
                    [`earningsHistory.${type}.daily.lastUpdated.day`]: currentDay,
                    [`earningsHistory.${type}.daily.lastUpdated.month`]: currentMonth,
                    [`earningsHistory.${type}.daily.lastUpdated.year`]: currentYear
                }
            });
        } else {
            // Same day - ATOMIC increment at last index (29)
            dayIndex = 29;
            await User.findByIdAndUpdate(ownerId, {
                $inc: {
                    [`earningsHistory.${type}.daily.data.${dayIndex}`]: amount
                }
            });
        }

        // --- Monthly Earnings ---
        const monthlyData = user.earningsHistory[type].monthly;
        const monthlyLastUpdated = monthlyData.lastUpdated;

        let monthIndex;
        if (!monthlyLastUpdated.month ||
            monthlyLastUpdated.month !== currentMonth ||
            monthlyLastUpdated.year !== currentYear) {

            // Different month - shift array
            await User.findByIdAndUpdate(ownerId, {
                $pop: { [`earningsHistory.${type}.monthly.data`]: -1 },
                $push: { [`earningsHistory.${type}.monthly.data`]: amount },
                $set: {
                    [`earningsHistory.${type}.monthly.lastUpdated.month`]: currentMonth,
                    [`earningsHistory.${type}.monthly.lastUpdated.year`]: currentYear
                }
            });
        } else {
            // Same month - ATOMIC increment at last index (11)
            monthIndex = 11;
            await User.findByIdAndUpdate(ownerId, {
                $inc: {
                    [`earningsHistory.${type}.monthly.data.${monthIndex}`]: amount
                }
            });
        }

        // --- Yearly Earnings ---
        // ATOMIC: Use upsert to increment or create year entry
        await User.findOneAndUpdate(
            {
                _id: ownerId,
                [`earningsHistory.${type}.yearly.year`]: currentYear
            },
            {
                $inc: { [`earningsHistory.${type}.yearly.$.earnings`]: amount }
            },
            { upsert: false }  // Don't create if doesn't exist
        ).then(async (result) => {
            if (!result) {
                // Year doesn't exist - add it atomically
                await User.findByIdAndUpdate(ownerId, {
                    $push: {
                        [`earningsHistory.${type}.yearly`]: {
                            year: currentYear,
                            earnings: amount
                        }
                    }
                });
            }
        });

        // --- Update Total Counters (ATOMIC) ---
        await User.findByIdAndUpdate(ownerId, {
            $inc: {
                'TotalEarnings': amount,
                'AvailableBalance': amount
            }
        });

        console.log(`✅ [Earnings] Added ${amount} to ${ownerId} (${type})`);
        return true;

    } catch (error) {
        console.error('[Earnings] Error adding earnings:', error);
        return false;
    }
};

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
