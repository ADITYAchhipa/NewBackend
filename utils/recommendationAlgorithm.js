// utils/recommendationAlgorithm.js
// Smart recommendation algorithm for similar properties and vehicles

/**
 * Calculate similarity score between two properties
 * @param {Object} baseProperty - The property to compare against
 * @param {Object} candidateProperty - The property to score
 * @returns {number} - Similarity score (0-100)
 */
export function calculatePropertySimilarity(baseProperty, candidateProperty) {
    let totalScore = 0;
    const weights = {
        location: 40,
        price: 25,
        category: 20,
        amenities: 10,
        rating: 5,
    };

    // 1. Location Score (40%)
    let locationScore = 0;
    if (baseProperty.city && candidateProperty.city) {
        if (baseProperty.city.toLowerCase() === candidateProperty.city.toLowerCase()) {
            locationScore = 100;
        } else if (baseProperty.state && candidateProperty.state &&
            baseProperty.state.toLowerCase() === candidateProperty.state.toLowerCase()) {
            locationScore = 60;
        } else {
            locationScore = 20;
        }
    } else {
        locationScore = 50; // neutral if no location data
    }
    totalScore += (locationScore * weights.location) / 100;

    // 2. Price Score (25%)
    let priceScore = 0;
    const basePrice = baseProperty.price?.perMonth || baseProperty.price?.perDay || 0;
    const candidatePrice = candidateProperty.price?.perMonth || candidateProperty.price?.perDay || 0;

    if (basePrice > 0 && candidatePrice > 0) {
        const priceDiff = Math.abs(basePrice - candidatePrice) / basePrice;
        if (priceDiff <= 0.3) { // Within 30%
            priceScore = 100 - (priceDiff * 100);
        } else if (priceDiff <= 0.5) { // Within 50%
            priceScore = 50 - ((priceDiff - 0.3) * 100);
        } else {
            priceScore = 20;
        }
    } else {
        priceScore = 50; // neutral if no price
    }
    totalScore += (priceScore * weights.price) / 100;

    // 3. Category Score (20%)
    let categoryScore = 0;
    if (baseProperty.category === candidateProperty.category) {
        categoryScore = 100;
    } else if (baseProperty.categoryType === candidateProperty.categoryType) {
        categoryScore = 60; // Same type (residential, commercial, venue) but different category
    } else {
        categoryScore = 20;
    }
    totalScore += (categoryScore * weights.category) / 100;

    // 4. Amenities Score (10%)
    let amenitiesScore = 0;
    const bedroomDiff = Math.abs((baseProperty.bedrooms || 0) - (candidateProperty.bedrooms || 0));
    const bathroomDiff = Math.abs((baseProperty.bathrooms || 0) - (candidateProperty.bathrooms || 0));

    // Bedrooms similarity
    if (bedroomDiff === 0) amenitiesScore += 40;
    else if (bedroomDiff === 1) amenitiesScore += 25;
    else amenitiesScore += 10;

    // Bathrooms similarity
    if (bathroomDiff === 0) amenitiesScore += 30;
    else if (bathroomDiff === 1) amenitiesScore += 15;
    else amenitiesScore += 5;

    // Furnished status
    if (baseProperty.furnished === candidateProperty.furnished) {
        amenitiesScore += 30;
    } else {
        amenitiesScore += 10;
    }

    totalScore += (amenitiesScore * weights.amenities) / 100;

    // 5. Rating Score (5%)
    let ratingScore = 0;
    const baseRating = baseProperty.rating?.avg || 0;
    const candidateRating = candidateProperty.rating?.avg || 0;

    if (candidateRating >= baseRating) {
        ratingScore = 100;
    } else {
        const ratingDiff = baseRating - candidateRating;
        ratingScore = Math.max(0, 100 - (ratingDiff * 25));
    }
    totalScore += (ratingScore * weights.rating) / 100;

    return totalScore;
}

/**
 * Calculate similarity score between two vehicles
 * @param {Object} baseVehicle - The vehicle to compare against
 * @param {Object} candidateVehicle - The vehicle to score
 * @returns {number} - Similarity score (0-100)
 */
export function calculateVehicleSimilarity(baseVehicle, candidateVehicle) {
    let totalScore = 0;
    const weights = {
        location: 40,
        price: 30,
        vehicleType: 15,
        features: 10,
        rating: 5,
    };

    // 1. Location Score (40%)
    let locationScore = 0;
    if (baseVehicle.location?.city && candidateVehicle.location?.city) {
        if (baseVehicle.location.city.toLowerCase() === candidateVehicle.location.city.toLowerCase()) {
            locationScore = 100;
        } else if (baseVehicle.location?.state && candidateVehicle.location?.state &&
            baseVehicle.location.state.toLowerCase() === candidateVehicle.location.state.toLowerCase()) {
            locationScore = 60;
        } else {
            locationScore = 20;
        }
    } else {
        locationScore = 50;
    }
    totalScore += (locationScore * weights.location) / 100;

    // 2. Price Score (30%)
    let priceScore = 0;
    const basePrice = baseVehicle.price?.perDay || baseVehicle.price?.perHour || 0;
    const candidatePrice = candidateVehicle.price?.perDay || candidateVehicle.price?.perHour || 0;

    if (basePrice > 0 && candidatePrice > 0) {
        const priceDiff = Math.abs(basePrice - candidatePrice) / basePrice;
        if (priceDiff <= 0.3) {
            priceScore = 100 - (priceDiff * 100);
        } else if (priceDiff <= 0.5) {
            priceScore = 50 - ((priceDiff - 0.3) * 100);
        } else {
            priceScore = 20;
        }
    } else {
        priceScore = 50;
    }
    totalScore += (priceScore * weights.price) / 100;

    // 3. Vehicle Type Score (15%)
    let typeScore = 0;
    if (baseVehicle.vehicleType === candidateVehicle.vehicleType) {
        typeScore = 100;
    } else {
        typeScore = 30;
    }
    totalScore += (typeScore * weights.vehicleType) / 100;

    // 4. Features Score (10%)
    let featuresScore = 0;

    // Seats similarity
    const seatsDiff = Math.abs((baseVehicle.seats || 0) - (candidateVehicle.seats || 0));
    if (seatsDiff === 0) featuresScore += 40;
    else if (seatsDiff <= 2) featuresScore += 20;
    else featuresScore += 5;

    // Transmission match
    if (baseVehicle.transmission === candidateVehicle.transmission) {
        featuresScore += 30;
    } else {
        featuresScore += 10;
    }

    // Fuel type match
    if (baseVehicle.fuelType === candidateVehicle.fuelType) {
        featuresScore += 30;
    } else {
        featuresScore += 10;
    }

    totalScore += (featuresScore * weights.features) / 100;

    // 5. Rating Score (5%)
    let ratingScore = 0;
    const baseRating = baseVehicle.rating?.avg || 0;
    const candidateRating = candidateVehicle.rating?.avg || 0;

    if (candidateRating >= baseRating) {
        ratingScore = 100;
    } else {
        const ratingDiff = baseRating - candidateRating;
        ratingScore = Math.max(0, 100 - (ratingDiff * 25));
    }
    totalScore += (ratingScore * weights.rating) / 100;

    return totalScore;
}

/**
 * Get similar properties based on the base property
 * @param {Object} baseProperty - The property to find similar items for
 * @param {Array} allProperties - All available properties
 * @param {number} limit - Number of similar properties to return
 * @returns {Array} - Sorted array of similar properties with scores
 */
export function getSimilarProperties(baseProperty, allProperties, limit = 6) {
    const scoredProperties = allProperties
        .filter(prop => prop._id.toString() !== baseProperty._id.toString()) // Exclude the base property
        .map(prop => ({
            property: prop,
            score: calculatePropertySimilarity(baseProperty, prop),
        }))
        .sort((a, b) => b.score - a.score) // Sort by score descending
        .slice(0, limit); // Take top N

    return scoredProperties;
}

/**
 * Get similar vehicles based on the base vehicle
 * @param {Object} baseVehicle - The vehicle to find similar items for
 * @param {Array} allVehicles - All available vehicles
 * @param {number} limit - Number of similar vehicles to return
 * @returns {Array} - Sorted array of similar vehicles with scores
 */
export function getSimilarVehicles(baseVehicle, allVehicles, limit = 6) {
    const scoredVehicles = allVehicles
        .filter(veh => veh._id.toString() !== baseVehicle._id.toString()) // Exclude the base vehicle
        .map(veh => ({
            vehicle: veh,
            score: calculateVehicleSimilarity(baseVehicle, veh),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

    return scoredVehicles;
}
