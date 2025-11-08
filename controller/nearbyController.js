import Property from '../models/property.js';
import Vehicle from '../models/vehicle.js';
import axios from 'axios';

/**
 * Find current coordinates of user based on IP address
 * Uses IP geolocation API as fallback when coordinates are not provided
 */
const findCurrentCoordinates = async (req) => {
  try {
    // Get IP address from request
    let ip = req.headers['x-forwarded-for']?.split(',')[0] || 
             req.headers['x-real-ip'] || 
             req.connection.remoteAddress || 
             req.socket.remoteAddress;
    
    // Clean up IP address (remove IPv6 prefix if present)
    let cleanIp = ip?.replace('::ffff:', '').trim();
    
    console.log('Detected IP:', cleanIp);
    
    // Check if IP is localhost or private network
    const isLocalhost = !cleanIp || 
                       cleanIp === '127.0.0.1' || 
                       cleanIp === '::1' || 
                       cleanIp === 'localhost' ||
                       cleanIp.startsWith('192.168.') ||
                       cleanIp.startsWith('10.') ||
                       cleanIp.startsWith('172.');
    
    // For localhost/development, use empty string to get location from API's server IP
    if (isLocalhost) {
      cleanIp = '';
      console.log('Localhost detected, using API server location as fallback');
    }
    
    // Use a free IP geolocation service (ip-api.com)
    // Note: For production, consider using a paid service with higher rate limits
    const url = cleanIp ? `http://ip-api.com/json/${cleanIp}` : 'http://ip-api.com/json';
    console.log('Requesting geolocation from:', url);
    
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0'
      }
    });
    
    console.log('Geolocation API response:', response.data);
    
    if (response.data && response.data.status === 'success') {
      return {
        latitude: response.data.lat,
        longitude: response.data.lon,
        city: response.data.city,
        region: response.data.regionName,
        country: response.data.country,
        ip: response.data.query,
        source: isLocalhost ? 'ip_geolocation_fallback' : 'ip_geolocation'
      };
    }
    
    // If API returns fail status, throw with the message
    if (response.data && response.data.status === 'fail') {
      throw new Error(response.data.message || 'IP geolocation failed');
    }
    
    throw new Error('Unable to determine location from IP');
  } catch (error) {
    console.error('Error finding coordinates from IP:', error.message);
    if (error.response) {
      console.error('API Error Response:', error.response.data);
    }
    throw new Error('Could not determine your location. Please provide coordinates manually (latitude and longitude as query parameters).');
  }
};

/**
 * Get user's current coordinates from request
 * This will be sent from the frontend when user opens the app
 */
const getUserCoordinates = (req) => {
  const { latitude, longitude } = req.query;
  
  if (!latitude || !longitude) {
    throw new Error('Latitude and longitude are required');
  }

  const lat = parseFloat(latitude);
  const lng = parseFloat(longitude);

  if (isNaN(lat) || isNaN(lng)) {
    throw new Error('Invalid coordinates');
  }

  // Validate coordinate ranges
  if (lat < -90 || lat > 90) {
    throw new Error('Latitude must be between -90 and 90');
  }

  if (lng < -180 || lng > 180) {
    throw new Error('Longitude must be between -180 and 180');
  }

  return { latitude: lat, longitude: lng, source: 'query_params' };
};

/**
 * Find properties near user location
 */
const findNearbyProperties = async (latitude, longitude, maxDistance = 10000) => {
  try {
    // MongoDB $near query requires coordinates in [longitude, latitude] format (GeoJSON)
    const properties = await Property.find({
      locationGeo: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [longitude, latitude] // [lng, lat]
          },
          $maxDistance: maxDistance // in meters (default 10km)
        }
      },
      status: 'active',
      available: true
    })
    .limit(10) // Limit results to avoid overwhelming the client
    .select('-__v') // Exclude version key
    .populate('ownerId', 'name avatar phone') // Populate owner details
    .lean(); // Return plain JavaScript objects

    // Calculate distance and add it to results
    const propertiesWithDistance = properties.map(property => {
      const distance = calculateDistance(
        latitude,
        longitude,
        property.locationGeo.coordinates[1],
        property.locationGeo.coordinates[0]
      );

      return {
        ...property,
        distance: Math.round(distance * 100) / 100, // Round to 2 decimal places
        distanceUnit: 'km'
      };
    });

    return propertiesWithDistance;
  } catch (error) {
    console.error('Error finding nearby properties:', error);
    throw error;
  }
};

/**
 * Find vehicles near user location
 */
const findNearbyVehicles = async (latitude, longitude, maxDistance = 10000) => {
  try {
    const vehicles = await Vehicle.find({
      'location.coordinates': {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [longitude, latitude] // [lng, lat]
          },
          $maxDistance: maxDistance // in meters (default 10km)
        }
      },
      status: 'active',
      available: true
    })
    .limit(50)
    .select('-__v')
    .populate('ownerId', 'name avatar phone')
    .lean();

    // Calculate distance and add it to results
    const vehiclesWithDistance = vehicles.map(vehicle => {
      const distance = calculateDistance(
        latitude,
        longitude,
        vehicle.location.coordinates[1],
        vehicle.location.coordinates[0]
      );

      return {
        ...vehicle,
        distance: Math.round(distance * 100) / 100,
        distanceUnit: 'km'
      };
    });

    return vehiclesWithDistance;
  } catch (error) {
    console.error('Error finding nearby vehicles:', error);
    throw error;
  }
};

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in kilometers
 */
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return distance;
};

const toRadians = (degrees) => {
  return degrees * (Math.PI / 180);
};

/**
 * Main controller function to get nearby properties and vehicles
 */
export const getNearbyListings = async (req, res) => {
  try {
    // Step 1: Get user coordinates from request
    const { latitude, longitude } = getUserCoordinates(req);

    // Optional: Get maxDistance from query (in kilometers, convert to meters)
    const maxDistanceKm = parseFloat(req.query.maxDistance) || 10; // Default 10km
    const maxDistance = maxDistanceKm * 1000; // Convert to meters

    // Optional: Get type filter (properties, vehicles, or both)
    const type = req.query.type || 'all'; // 'properties', 'vehicles', or 'all'

    // Step 2: Find nearby properties and vehicles in parallel
    const [properties, vehicles] = await Promise.all([
      type === 'vehicles' ? [] : findNearbyProperties(latitude, longitude, maxDistance),
      type === 'properties' ? [] : findNearbyVehicles(latitude, longitude, maxDistance)
    ]);

    // Step 3: Send response
    res.json({
      success: true,
      data: {
        location: {
          latitude,
          longitude,
          searchRadius: maxDistanceKm,
          searchRadiusUnit: 'km'
        },
        properties: properties,
        vehicles: vehicles,
        total: {
          properties: properties.length,
          vehicles: vehicles.length,
          all: properties.length + vehicles.length
        }
      },
      message: 'Nearby listings fetched successfully'
    });

  } catch (error) {
    console.error('Error in getNearbyListings:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to fetch nearby listings'
    });
  }
};

/**
 * Get only nearby properties
 */
export const getNearbyProperties = async (req, res) => {
  try {
    // const { latitude, longitude } = getUserCoordinates(req);
    const { latitude, longitude } = req.body;
    const maxDistanceKm = parseFloat(req.query.maxDistance) || 10;
    const maxDistance = maxDistanceKm * 1000;

    const properties = await findNearbyProperties(latitude, longitude, maxDistance);

    res.json({
      success: true,
      data: {
        location: { latitude, longitude, searchRadius: maxDistanceKm, searchRadiusUnit: 'km' },
        properties,
        total: properties.length
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to fetch nearby properties'
    });
  }
};

/**
 * Get only nearby vehicles
 */
export const getNearbyVehicles = async (req, res) => {
  try {
    const { latitude, longitude } = getUserCoordinates(req);
    const maxDistanceKm = parseFloat(req.query.maxDistance) || 10;
    const maxDistance = maxDistanceKm * 1000;

    const vehicles = await findNearbyVehicles(latitude, longitude, maxDistance);

    res.json({
      success: true,
      data: {
        location: { latitude, longitude, searchRadius: maxDistanceKm, searchRadiusUnit: 'km' },
        vehicles,
        total: vehicles.length
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to fetch nearby vehicles'
    });
  }
};

/**
 * Get current coordinates of the user
 * Tries to get from query params first, falls back to IP geolocation
 */
export const getCurrentCoordinates = async (req, res) => {
  try {
    let coordinates;
    
    // Try to get coordinates from query parameters first
    try {
      coordinates = getUserCoordinates(req);
    } catch (error) {
      // If query params not provided, use IP geolocation
      coordinates = await findCurrentCoordinates(req);
    }

    res.json({
      success: true,
      data: coordinates,
      message: 'Current coordinates retrieved successfully'
    });
  } catch (error) {
    console.error('Error getting current coordinates:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to get current coordinates'
    });
  }
};
