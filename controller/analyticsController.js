// controller/analyticsController.js
// Owner Analytics API - Revenue, Bookings, User Behavior, Insights
import Property from '../models/property.js';
import Vehicle from '../models/vehicle.js';
import Booking from '../models/booking.js';
import mongoose from 'mongoose';




export const getOwnerAnalytics = async (req, res) => {
    try {
        const userId = req.userId;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Not authenticated' });
        }

        const {
            assetType = 'all',
            dateFrom,
            dateTo,
            location,
            category
        } = req.query;

        // Date range defaults to last 30 days
        const endDate = dateTo ? new Date(dateTo) : new Date();
        const startDate = dateFrom ? new Date(dateFrom) : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

        // Build base filters
        const ownerFilter = { ownerId: new mongoose.Types.ObjectId(userId), status: { $ne: 'deleted' } };
        if (location) {
            ownerFilter.city = { $regex: location, $options: 'i' };
        }
        if (category) {
            ownerFilter.category = category;
        }

        // Fetch properties if needed
        let properties = [];
        let propertyBookings = [];
        if (assetType === 'all' || assetType === 'property') {
            properties = await Property.find(ownerFilter).lean();
            const propertyIds = properties.map(p => p._id);

            if (propertyIds.length > 0) {
                propertyBookings = await Booking.find({
                    propertyId: { $in: propertyIds },
                    createdAt: { $gte: startDate, $lte: endDate }
                }).lean();
            }
        }

        // Fetch vehicles if needed
        let vehicles = [];
        let vehicleBookings = [];
        if (assetType === 'all' || assetType === 'vehicle') {
            const vehicleFilter = {
                ownerId: new mongoose.Types.ObjectId(userId),
                status: { $ne: 'deleted' }
            };
            if (location) {
                vehicleFilter['location.city'] = { $regex: location, $options: 'i' };
            }
            if (category) {
                vehicleFilter.vehicleType = category;
            }

            vehicles = await Vehicle.find(vehicleFilter).lean();
            const vehicleIds = vehicles.map(v => v._id);

            if (vehicleIds.length > 0) {
                vehicleBookings = await Booking.find({
                    vehicleId: { $in: vehicleIds },
                    createdAt: { $gte: startDate, $lte: endDate }
                }).lean();
            }
        }

        // Combine all bookings
        const allBookings = [...propertyBookings, ...vehicleBookings];
        const allAssets = [...properties, ...vehicles];

        // Calculate overview metrics
        const overview = calculateOverviewMetrics(properties, vehicles, allBookings, startDate, endDate, assetType);

        // Calculate revenue data
        const revenue = calculateRevenueData(allBookings, properties, vehicles, startDate, endDate);

        // Calculate booking stats
        const bookings = calculateBookingStats(allBookings);

        // Calculate user behavior
        const userBehavior = calculateUserBehavior(properties, vehicles, allBookings);

        // Generate trends and forecasts
        const trends = generateTrends(allBookings, startDate, endDate);

        // Generate AI insights
        const insights = generateInsights(overview, revenue, bookings, assetType);

        // Find top performing asset
        const topAsset = findTopPerformingAsset(properties, vehicles, allBookings);

        // Generate booking heatmap (7 days x 24 hours)
        const heatmap = generateBookingHeatmap(allBookings);

        return res.json({
            success: true,
            data: {
                overview,
                revenue,
                bookings,
                userBehavior,
                trends,
                insights,
                topAsset,
                heatmap,
                filters: {
                    assetType,
                    dateFrom: startDate.toISOString(),
                    dateTo: endDate.toISOString(),
                    location: location || null,
                    category: category || null
                }
            }
        });

    } catch (error) {
        console.error('Error fetching owner analytics:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Calculate overview metrics
 */
function calculateOverviewMetrics(properties, vehicles, bookings, startDate, endDate, assetType) {
    const totalListings = properties.length + vehicles.length;
    const activeListings = properties.filter(p => p.status === 'active').length +
        vehicles.filter(v => v.status === 'active').length;

    // Calculate occupancy/utilization rate
    const dayRange = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) || 30;
    const confirmedBookings = bookings.filter(b => b.status === 'confirmed' || b.status === 'completed');

    let totalBookedDays = 0;
    confirmedBookings.forEach(booking => {
        const bookingStart = new Date(booking.startDate);
        const bookingEnd = new Date(booking.endDate);
        const bookedDays = Math.ceil((bookingEnd - bookingStart) / (1000 * 60 * 60 * 24));
        totalBookedDays += bookedDays;
    });

    const maxPossibleDays = totalListings * dayRange;
    const occupancyRate = maxPossibleDays > 0 ? Math.round((totalBookedDays / maxPossibleDays) * 100) : 0;

    // Calculate total revenue
    const totalRevenue = confirmedBookings.reduce((sum, b) => sum + (b.totalPrice || 0), 0);

    // Calculate average daily rent
    const avgDailyRent = totalBookedDays > 0 ? Math.round(totalRevenue / totalBookedDays) : 0;

    // Monthly bookings (in the date range)
    const monthlyBookings = confirmedBookings.length;

    // Repeat customers percentage (mock - would need user history)
    const uniqueUsers = new Set(bookings.map(b => b.userId?.toString())).size;
    const repeatCustomers = uniqueUsers > 0 ? Math.round((uniqueUsers * 0.3) * 100) / 100 * 15 : 0; // Simulated

    // User satisfaction score (average rating)
    const allRatings = [
        ...properties.map(p => p.rating?.avg || 0),
        ...vehicles.map(v => v.rating?.avg || 0)
    ].filter(r => r > 0);
    const satisfactionScore = allRatings.length > 0
        ? Math.round((allRatings.reduce((a, b) => a + b, 0) / allRatings.length) * 10) / 10
        : 0;

    // Maintenance alerts (mock - could be based on last service date, etc.)
    const maintenanceAlerts = Math.floor(Math.random() * 3);

    return {
        totalListings,
        activeListings,
        occupancyRate: assetType === 'vehicle' ? occupancyRate : occupancyRate, // Same calc, different label in UI
        utilizationRate: occupancyRate, // For vehicles
        totalRevenue,
        avgDailyRent,
        monthlyBookings,
        repeatCustomers: Math.round(repeatCustomers),
        satisfactionScore,
        maintenanceAlerts,
        currency: 'INR'
    };
}

/**
 * Calculate revenue data for charts
 */
function calculateRevenueData(bookings, properties, vehicles, startDate, endDate) {
    const confirmedBookings = bookings.filter(b => b.status === 'confirmed' || b.status === 'completed');

    // Monthly revenue (last 6 months)
    const monthly = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
        const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
        const monthRevenue = confirmedBookings
            .filter(b => {
                const created = new Date(b.createdAt);
                return created >= monthStart && created <= monthEnd;
            })
            .reduce((sum, b) => sum + (b.totalPrice || 0), 0);

        monthly.push({
            month: monthStart.toLocaleString('default', { month: 'short' }),
            year: monthStart.getFullYear(),
            revenue: monthRevenue
        });
    }

    // Daily revenue (last 30 days)
    const daily = [];
    for (let i = 29; i >= 0; i--) {
        const day = new Date(endDate.getTime() - i * 24 * 60 * 60 * 1000);
        const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate());
        const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

        const dayRevenue = confirmedBookings
            .filter(b => {
                const created = new Date(b.createdAt);
                return created >= dayStart && created < dayEnd;
            })
            .reduce((sum, b) => sum + (b.totalPrice || 0), 0);

        daily.push({
            date: dayStart.toISOString().split('T')[0],
            revenue: dayRevenue
        });
    }

    // Revenue by category
    const byCategory = {};
    confirmedBookings.forEach(booking => {
        let categoryName = 'Unknown';
        if (booking.propertyId) {
            const property = properties.find(p => p._id.toString() === booking.propertyId.toString());
            categoryName = property?.category || 'Property';
        } else if (booking.vehicleId) {
            const vehicle = vehicles.find(v => v._id.toString() === booking.vehicleId.toString());
            categoryName = vehicle?.vehicleType || 'Vehicle';
        }
        byCategory[categoryName] = (byCategory[categoryName] || 0) + (booking.totalPrice || 0);
    });

    const byCategoryArray = Object.entries(byCategory).map(([category, revenue]) => ({
        category,
        revenue
    })).sort((a, b) => b.revenue - a.revenue);

    // Comparison with previous period
    const periodLength = endDate - startDate;
    const prevStart = new Date(startDate.getTime() - periodLength);
    const prevEnd = new Date(startDate.getTime() - 1);

    const currentRevenue = confirmedBookings.reduce((sum, b) => sum + (b.totalPrice || 0), 0);
    // Mock previous revenue (would need separate query in real implementation)
    const previousRevenue = Math.round(currentRevenue * (0.7 + Math.random() * 0.4));
    const revenueChange = previousRevenue > 0
        ? Math.round(((currentRevenue - previousRevenue) / previousRevenue) * 100)
        : 0;

    return {
        monthly,
        daily,
        byCategory: byCategoryArray,
        comparison: {
            current: currentRevenue,
            previous: previousRevenue,
            change: revenueChange,
            periodLabel: 'vs Previous 30 Days'
        }
    };
}

/**
 * Calculate booking statistics
 */
function calculateBookingStats(bookings) {
    const total = bookings.length;
    const confirmed = bookings.filter(b => b.status === 'confirmed').length;
    const completed = bookings.filter(b => b.status === 'completed').length;
    const cancelled = bookings.filter(b => b.status === 'cancelled').length;

    const successRate = total > 0 ? Math.round(((confirmed + completed) / total) * 100) : 0;

    // Cancellation reasons (mock data - would need reason field in booking)
    const cancellationReasons = [
        { reason: 'Change of plans', count: Math.floor(cancelled * 0.4) },
        { reason: 'Found alternative', count: Math.floor(cancelled * 0.25) },
        { reason: 'Price concerns', count: Math.floor(cancelled * 0.2) },
        { reason: 'Other', count: Math.ceil(cancelled * 0.15) }
    ].filter(r => r.count > 0);

    // Average rental duration
    const confirmedBookings = bookings.filter(b => b.status === 'confirmed' || b.status === 'completed');
    let totalDuration = 0;
    confirmedBookings.forEach(booking => {
        const start = new Date(booking.startDate);
        const end = new Date(booking.endDate);
        totalDuration += Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    });
    const avgDuration = confirmedBookings.length > 0 ? Math.round(totalDuration / confirmedBookings.length) : 0;

    // Booking sources (mock - would need source tracking)
    const sources = {
        app: Math.floor(total * 0.45),
        website: Math.floor(total * 0.30),
        direct: Math.floor(total * 0.15),
        referral: Math.ceil(total * 0.10)
    };

    return {
        total,
        confirmed,
        completed,
        cancelled,
        successRate,
        cancellationReasons,
        avgDuration,
        sources
    };
}

/**
 * Calculate user behavior metrics
 */
function calculateUserBehavior(properties, vehicles, bookings) {
    // Total views from property/vehicle meta
    const views = properties.reduce((sum, p) => sum + (p.meta?.views || 0), 0) +
        vehicles.reduce((sum, v) => sum + (v.meta?.views || 0), 0);

    // Saves/favorites (mock - would need favorites collection)
    const saves = Math.floor(views * 0.15);

    // Message to booking conversion (mock)
    const messages = Math.floor(views * 0.25);
    const bookingCount = bookings.filter(b => b.status !== 'cancelled').length;
    const conversionRate = messages > 0 ? Math.round((bookingCount / messages) * 100) : 0;

    // Conversion funnel
    const funnel = {
        views: views,
        inquiries: messages,
        bookings: bookingCount + Math.floor(bookingCount * 0.2), // Add pending
        completions: bookings.filter(b => b.status === 'completed').length
    };

    return {
        views,
        saves,
        messages,
        conversionRate,
        funnel
    };
}

/**
 * Generate trend analysis
 */
function generateTrends(bookings, startDate, endDate) {
    // Analyze bookings by day of week
    const dayOfWeekCounts = [0, 0, 0, 0, 0, 0, 0]; // Sun-Sat
    bookings.forEach(b => {
        const day = new Date(b.createdAt).getDay();
        dayOfWeekCounts[day]++;
    });

    // Identify peak days
    const maxCount = Math.max(...dayOfWeekCounts);
    const peakDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
        .filter((_, i) => dayOfWeekCounts[i] === maxCount);

    // Peak seasons (mock - based on month patterns)
    const peakSeasons = [
        { period: 'Dec-Jan', description: 'Holiday season', impact: '+35%' },
        { period: 'Apr-May', description: 'Summer vacation', impact: '+25%' }
    ];

    // Low periods
    const lowPeriods = [
        { period: 'Jul-Aug', description: 'Monsoon season', impact: '-20%' }
    ];

    // Weekend vs weekday performance
    const weekendBookings = dayOfWeekCounts[0] + dayOfWeekCounts[6];
    const weekdayBookings = dayOfWeekCounts.slice(1, 6).reduce((a, b) => a + b, 0);
    const weekendVsWeekday = weekdayBookings > 0
        ? Math.round((weekendBookings / (weekdayBookings / 5)) * 100) - 100
        : 0;

    // Forecast for next 30 days (simple linear projection)
    const avgDailyBookings = bookings.length / 30;
    const forecast = [];
    for (let i = 1; i <= 30; i++) {
        const futureDate = new Date(endDate.getTime() + i * 24 * 60 * 60 * 1000);
        const dayOfWeek = futureDate.getDay();
        // Add weekend boost
        const weekendMultiplier = (dayOfWeek === 0 || dayOfWeek === 6) ? 1.2 : 1.0;
        forecast.push({
            date: futureDate.toISOString().split('T')[0],
            predictedBookings: Math.round(avgDailyBookings * weekendMultiplier * 10) / 10
        });
    }

    return {
        peakDays,
        peakSeasons,
        lowPeriods,
        weekendVsWeekday: `${weekendVsWeekday > 0 ? '+' : ''}${weekendVsWeekday}%`,
        forecast: forecast.slice(0, 7) // Just show next 7 days
    };
}

/**
 * Generate AI-powered insights and recommendations
 */
function generateInsights(overview, revenue, bookings, assetType) {
    const insights = {
        pricing: [],
        listing: [],
        engagement: [],
        alerts: []
    };

    // Pricing recommendations
    if (overview.occupancyRate < 50) {
        insights.pricing.push({
            title: 'Consider Lowering Prices',
            description: `Your ${assetType === 'vehicle' ? 'utilization' : 'occupancy'} rate is ${overview.occupancyRate}%. A 10-15% price reduction could improve bookings.`,
            suggestedAction: 'Reduce daily rate by 10%',
            impact: '+20-30% bookings expected'
        });
    }

    if (overview.occupancyRate > 85) {
        insights.pricing.push({
            title: 'Opportunity to Increase Prices',
            description: `High demand! Your ${assetType === 'vehicle' ? 'utilization' : 'occupancy'} rate is ${overview.occupancyRate}%.`,
            suggestedAction: 'Increase rates by 5-10%',
            impact: '+10-15% revenue expected'
        });
    }

    insights.pricing.push({
        title: 'Peak Season Pricing',
        description: 'Consider dynamic pricing for holidays and weekends.',
        suggestedAction: 'Set 15-20% higher rates for Dec-Jan',
        impact: '+25% revenue during peak'
    });

    // Listing quality suggestions
    insights.listing.push({
        title: 'Improve Photo Quality',
        description: 'Listings with professional photos get 40% more views.',
        suggestedAction: 'Add 8-10 high-quality images',
        impact: '+40% views'
    });

    if (overview.satisfactionScore < 4.0) {
        insights.listing.push({
            title: 'Improve Guest Experience',
            description: `Your rating is ${overview.satisfactionScore}/5. Focus on cleanliness and communication.`,
            suggestedAction: 'Respond to reviews and address concerns',
            impact: '+0.5 rating improvement'
        });
    }

    // Engagement boost tips
    insights.engagement.push({
        title: 'Reply Faster to Messages',
        description: 'Quick responses increase booking conversion by 25%.',
        suggestedAction: 'Respond within 1 hour',
        impact: '+25% conversion'
    });

    if (bookings.cancelled > bookings.completed) {
        insights.engagement.push({
            title: 'Reduce Cancellations',
            description: 'Your cancellation rate is high. Consider flexible policies.',
            suggestedAction: 'Offer free cancellation up to 24 hours',
            impact: '-30% cancellations'
        });
    }

    // Asset-specific alerts
    if (assetType === 'vehicle' || assetType === 'all') {
        insights.alerts.push({
            type: 'vehicle',
            title: 'Upcoming Service Due',
            description: 'Vehicle maintenance reminder',
            suggestedAction: 'Schedule service within 7 days',
            priority: 'medium'
        });
        insights.alerts.push({
            type: 'vehicle',
            title: 'Insurance Renewal',
            description: 'Check insurance expiry dates',
            suggestedAction: 'Verify all documents are current',
            priority: 'high'
        });
    }

    if (assetType === 'property' || assetType === 'all') {
        insights.alerts.push({
            type: 'property',
            title: 'Cleaning Schedule',
            description: 'Regular deep cleaning recommended',
            suggestedAction: 'Schedule monthly deep clean',
            priority: 'low'
        });
        insights.alerts.push({
            type: 'property',
            title: 'Utility Check',
            description: 'Review monthly utility consumption',
            suggestedAction: 'Compare with previous months',
            priority: 'medium'
        });
    }

    return insights;
}

/**
 * Find the top performing asset
 */
function findTopPerformingAsset(properties, vehicles, bookings) {
    const assetRevenue = {};

    bookings.filter(b => b.status === 'confirmed' || b.status === 'completed').forEach(booking => {
        const assetId = booking.propertyId?.toString() || booking.vehicleId?.toString();
        if (assetId) {
            assetRevenue[assetId] = (assetRevenue[assetId] || 0) + (booking.totalPrice || 0);
        }
    });

    let topAsset = null;
    let maxRevenue = 0;

    for (const [assetId, revenue] of Object.entries(assetRevenue)) {
        if (revenue > maxRevenue) {
            maxRevenue = revenue;
            // Find the asset
            const property = properties.find(p => p._id.toString() === assetId);
            const vehicle = vehicles.find(v => v._id.toString() === assetId);

            if (property) {
                topAsset = {
                    id: assetId,
                    type: 'property',
                    title: property.title,
                    image: property.images?.[0] || null,
                    revenue: revenue,
                    occupancy: Math.round((property.meta?.bookings || 0) / 30 * 100),
                    rating: property.rating?.avg || 0
                };
            } else if (vehicle) {
                topAsset = {
                    id: assetId,
                    type: 'vehicle',
                    title: `${vehicle.make} ${vehicle.model}`,
                    image: vehicle.photos?.[0] || null,
                    revenue: revenue,
                    occupancy: Math.round((vehicle.meta?.bookings || 0) / 30 * 100),
                    rating: vehicle.rating?.avg || 0
                };
            }
        }
    }

    // If no bookings, return first active asset
    if (!topAsset) {
        const firstProperty = properties.find(p => p.status === 'active');
        const firstVehicle = vehicles.find(v => v.status === 'active');

        if (firstProperty) {
            topAsset = {
                id: firstProperty._id.toString(),
                type: 'property',
                title: firstProperty.title,
                image: firstProperty.images?.[0] || null,
                revenue: 0,
                occupancy: 0,
                rating: firstProperty.rating?.avg || 0
            };
        } else if (firstVehicle) {
            topAsset = {
                id: firstVehicle._id.toString(),
                type: 'vehicle',
                title: `${firstVehicle.make} ${firstVehicle.model}`,
                image: firstVehicle.photos?.[0] || null,
                revenue: 0,
                occupancy: 0,
                rating: firstVehicle.rating?.avg || 0
            };
        }
    }

    return topAsset;
}

/**
 * Generate booking heatmap (7 days x 24 hours)
 */
function generateBookingHeatmap(bookings) {
    // Initialize 7x24 matrix (rows = days Sun-Sat, cols = hours 0-23)
    const heatmap = Array(7).fill(null).map(() => Array(24).fill(0));

    bookings.forEach(booking => {
        const created = new Date(booking.createdAt);
        const day = created.getDay(); // 0-6 (Sun-Sat)
        const hour = created.getHours(); // 0-23
        heatmap[day][hour]++;
    });

    // Find max value for normalization
    const maxValue = Math.max(...heatmap.flat());

    // Normalize to 0-1 scale
    const normalizedHeatmap = heatmap.map(row =>
        row.map(value => maxValue > 0 ? Math.round((value / maxValue) * 100) / 100 : 0)
    );

    return {
        data: normalizedHeatmap,
        maxValue,
        labels: {
            days: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
            hours: Array.from({ length: 24 }, (_, i) => `${i}:00`)
        }
    };
}

/**
 * Get revenue breakdown only
 * GET /api/analytics/owner/revenue
 */
export const getRevenueBreakdown = async (req, res) => {
    try {
        const userId = req.userId;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Not authenticated' });
        }

        const { assetType = 'all', dateFrom, dateTo } = req.query;

        const endDate = dateTo ? new Date(dateTo) : new Date();
        const startDate = dateFrom ? new Date(dateFrom) : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

        const ownerFilter = { ownerId: new mongoose.Types.ObjectId(userId), status: { $ne: 'deleted' } };

        let properties = [];
        let vehicles = [];
        let allBookings = [];

        if (assetType === 'all' || assetType === 'property') {
            properties = await Property.find(ownerFilter).lean();
            const propertyIds = properties.map(p => p._id);
            if (propertyIds.length > 0) {
                const pBookings = await Booking.find({
                    propertyId: { $in: propertyIds },
                    createdAt: { $gte: startDate, $lte: endDate }
                }).lean();
                allBookings = [...allBookings, ...pBookings];
            }
        }

        if (assetType === 'all' || assetType === 'vehicle') {
            vehicles = await Vehicle.find(ownerFilter).lean();
            const vehicleIds = vehicles.map(v => v._id);
            if (vehicleIds.length > 0) {
                const vBookings = await Booking.find({
                    vehicleId: { $in: vehicleIds },
                    createdAt: { $gte: startDate, $lte: endDate }
                }).lean();
                allBookings = [...allBookings, ...vBookings];
            }
        }

        const revenue = calculateRevenueData(allBookings, properties, vehicles, startDate, endDate);

        return res.json({ success: true, data: revenue });
    } catch (error) {
        console.error('Error fetching revenue:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Get AI insights only
 * GET /api/analytics/owner/insights
 */
export const getInsights = async (req, res) => {
    try {
        const userId = req.userId;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Not authenticated' });
        }

        const { assetType = 'all' } = req.query;

        // Fetch basic stats for insight generation
        const ownerFilter = { ownerId: new mongoose.Types.ObjectId(userId), status: { $ne: 'deleted' } };

        const properties = await Property.find(ownerFilter).lean();
        const vehicles = await Vehicle.find(ownerFilter).lean();

        const propertyIds = properties.map(p => p._id);
        const vehicleIds = vehicles.map(v => v._id);

        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

        const allBookings = await Booking.find({
            $or: [
                { propertyId: { $in: propertyIds } },
                { vehicleId: { $in: vehicleIds } }
            ],
            createdAt: { $gte: thirtyDaysAgo }
        }).lean();

        const overview = calculateOverviewMetrics(properties, vehicles, allBookings, thirtyDaysAgo, new Date(), assetType);
        const revenue = calculateRevenueData(allBookings, properties, vehicles, thirtyDaysAgo, new Date());
        const bookings = calculateBookingStats(allBookings);

        const insights = generateInsights(overview, revenue, bookings, assetType);

        return res.json({ success: true, data: insights });
    } catch (error) {
        console.error('Error fetching insights:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};
