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
const findNearbyProperties = async (latitude, longitude, maxDistance = 10000, city, debug = false) => {
  try {
    // MongoDB $near query requires coordinates in [longitude, latitude] format (GeoJSON)
    const baseFilter = { status: 'active', available: true };
    if (city) {
      baseFilter.city = new RegExp(`^${escapeRegExp(city)}$`, 'i');
    }

    if (debug) {
      console.log('[NEARBY][PROPERTY] Query start', {
        latitude,
        longitude,
        maxDistance,
        city,
        baseFilter
      });
    }

    const properties = await Property.find({
      ...baseFilter,
      locationGeo: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [longitude, latitude] // [lng, lat]
          },
          $maxDistance: maxDistance // in meters (default 10km)
        }
      }
    })
      .limit(10) // Limit results to avoid overwhelming the client
      .select('-__v') // Exclude version key
      .populate('ownerId', 'name avatar phone') // Populate owner details
      .lean(); // Return plain JavaScript objects

    if (debug) {
      const cities = [...new Set(properties.map(p => p.city).filter(Boolean))];
      console.log('[NEARBY][PROPERTY] DB results', { count: properties.length, sampleCities: cities.slice(0, 5) });
    }

    const maxKm = maxDistance / 1000;
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
        distance: Math.round(distance * 100) / 100,
        distanceUnit: 'km'
      };
    }).filter(p => p.distance <= maxKm).sort((a, b) => a.distance - b.distance);

    if (debug) {
      const cities = [...new Set(propertiesWithDistance.map(p => p.city).filter(Boolean))];
      console.log('[NEARBY][PROPERTY] After distance filter/sort', { count: propertiesWithDistance.length, sampleCities: cities.slice(0, 5) });
    }

    return propertiesWithDistance;
  } catch (error) {
    console.error('Error finding nearby properties:', error);
    throw error;
  }
};

/**
 * Find vehicles near user location
 */
const findNearbyVehicles = async (latitude, longitude, maxDistance = 10000, city, debug = false) => {
  try {
    const baseFilter = { status: 'active', available: true };
    if (city) {
      baseFilter['location.city'] = new RegExp(`^${escapeRegExp(city)}$`, 'i');
    }

    if (debug) {
      console.log('[NEARBY][VEHICLE] Query start', {
        latitude,
        longitude,
        maxDistance,
        city,
        baseFilter
      });
    }

    const vehicles = await Vehicle.find({
      ...baseFilter,
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [longitude, latitude] // [lng, lat]
          },
          $maxDistance: maxDistance // in meters (default 10km)
        }
      }
    })
      .limit(50)
      .select('-__v')
      .populate('ownerId', 'name avatar phone')
      .lean();

    if (debug) {
      const cities = [...new Set(vehicles.map(v => v?.location?.city).filter(Boolean))];
      console.log('[NEARBY][VEHICLE] DB results', { count: vehicles.length, sampleCities: cities.slice(0, 5) });
    }

    const maxKm = maxDistance / 1000;
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
    }).filter(v => v.distance <= maxKm).sort((a, b) => a.distance - b.distance);

    if (debug) {
      const cities = [...new Set(vehiclesWithDistance.map(v => v?.location?.city).filter(Boolean))];
      console.log('[NEARBY][VEHICLE] After distance filter/sort', { count: vehiclesWithDistance.length, sampleCities: cities.slice(0, 5) });
    }

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

// Escape RegExp special characters for safe city matching
const escapeRegExp = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const CITY_ALIASES = {
  delhi: ['new delhi', 'delhi ncr'],
  'new delhi': ['delhi', 'delhi ncr'],
  mumbai: ['bombay'],
  bombay: ['mumbai'],
  bengaluru: ['bangalore'],
  bangalore: ['bengaluru'],
  kolkata: ['calcutta'],
  calcutta: ['kolkata'],
  gurugram: ['gurgaon'],
  gurgaon: ['gurugram']
};

const normalizeCity = (s) => String(s || '').toLowerCase().trim();

const cityEquals = (a, b) => {
  const na = normalizeCity(a);
  const nb = normalizeCity(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const aa = CITY_ALIASES[na] || [];
  const ab = CITY_ALIASES[nb] || [];
  return aa.includes(nb) || ab.includes(na);
};

/**
 * Helper to resolve coordinates: try query params first, fallback to IP geolocation
 */
const resolveCoordinates = async (req) => {
  try {
    return getUserCoordinates(req);
  } catch (error) {
    // If query params failed/missing, try IP geolocation
    console.log('Coordinates not provided in query, falling back to IP geolocation...');
    return await findCurrentCoordinates(req);
  }
};

const findNearestCity = async (latitude, longitude, debug = false) => {
  if (debug) {
    console.log('[NEARBY] Resolving nearest city around coords', { latitude, longitude });
  }
  const prop = await Property.findOne({
    status: 'active',
    available: true,
    locationGeo: {
      $near: {
        $geometry: { type: 'Point', coordinates: [longitude, latitude] },
        $maxDistance: 50000
      }
    }
  }).select('city').lean();
  if (prop && prop.city) {
    if (debug) console.log('[NEARBY] Nearest city from property', prop.city);
    return prop.city;
  }

  const veh = await Vehicle.findOne({
    status: 'active',
    available: true,
    location: {
      $near: {
        $geometry: { type: 'Point', coordinates: [longitude, latitude] },
        $maxDistance: 50000
      }
    }
  }).select('location.city').lean();
  if (veh?.location?.city && debug) console.log('[NEARBY] Nearest city from vehicle', veh.location.city);
  return veh?.location?.city;
};

const resolveCityForSearch = async (req, coords, debug = false) => {
  const fromQuery = (req.query.city || '').trim();
  if (fromQuery) {
    if (debug) console.log('[NEARBY] City resolved from query param:', fromQuery);
    return fromQuery;
  }
  const fromCoords = (coords.city || '').trim();
  if (fromCoords) {
    if (debug) console.log('[NEARBY] City resolved from coordinates source:', fromCoords, 'source:', coords.source);
    return fromCoords;
  }
  try {
    const nearest = await findNearestCity(coords.latitude, coords.longitude, debug);
    if (nearest && debug) console.log('[NEARBY] City resolved from nearest listing:', nearest);
    return nearest;
  } catch (e) {
    if (debug) console.log('[NEARBY] Could not resolve city from any source');
    return undefined;
  }
};

/**
 * Main controller function to get nearby properties and vehicles
 */
export const getNearbyListings = async (req, res) => {
  try {
    // Step 1: Get user coordinates (auto-detect if missing)
    const coords = await resolveCoordinates(req);
    const { latitude, longitude } = coords;
    const debug = (process.env.NEARBY_DEBUG === '1') || (req.query.debug === '1');
    const city = (await resolveCityForSearch(req, coords, debug)) || undefined;

    if (debug) {
      console.log('[NEARBY] Incoming query', req.query);
      console.log('[NEARBY] Resolved coords/city', { latitude, longitude, city, source: coords.source });
    }

    // Enforce a maximum search radius of 10km
    const maxDistanceKm = Math.min(parseFloat(req.query.maxDistance) || 10, 10); // cap at 10km
    const maxDistance = maxDistanceKm * 1000; // Convert to meters

    // Optional: Get type filter (properties, vehicles, or both)
    const type = req.query.type || 'all'; // 'properties', 'vehicles', or 'all'

    // Step 2: Find nearby properties and vehicles in parallel
    const [properties, vehicles] = await Promise.all([
      type === 'vehicles' ? [] : findNearbyProperties(latitude, longitude, maxDistance, city, debug),
      type === 'properties' ? [] : findNearbyVehicles(latitude, longitude, maxDistance, city, debug)
    ]);

    const filteredProps = city ? properties.filter(p => cityEquals(p.city, city)) : properties;
    const filteredVehs = city ? vehicles.filter(v => cityEquals(v?.location?.city, city)) : vehicles;

    if (debug) {
      const citiesProps = [...new Set(filteredProps.map(p => p.city).filter(Boolean))];
      const citiesVehs = [...new Set(filteredVehs.map(v => v?.location?.city).filter(Boolean))];
      console.log('[NEARBY] Post-filter counts', {
        properties: filteredProps.length,
        vehicles: filteredVehs.length,
        citiesProps,
        citiesVehs
      });
    }

    // Step 3: Send response
    res.json({
      success: true,
      data: {
        location: {
          latitude,
          longitude,
          city,
          coordinateSource: coords.source,
          searchRadius: maxDistanceKm,
          searchRadiusUnit: 'km'
        },
        properties: filteredProps,
        vehicles: filteredVehs,
        total: {
          properties: filteredProps.length,
          vehicles: filteredVehs.length,
          all: filteredProps.length + filteredVehs.length
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
    const coords = await resolveCoordinates(req);
    const { latitude, longitude } = coords;
    const city = (await resolveCityForSearch(req, coords)) || undefined;
    const maxDistanceKm = Math.min(parseFloat(req.query.maxDistance) || 10, 10);
    const maxDistance = maxDistanceKm * 1000;
    const debug = (process.env.NEARBY_DEBUG === '1') || (req.query.debug === '1');

    const properties = await findNearbyProperties(latitude, longitude, maxDistance, city, debug);
    const filteredProps = city ? properties.filter(p => cityEquals(p.city, city)) : properties;

    res.json({
      success: true,
      data: {
        location: { latitude, longitude, city, coordinateSource: coords.source, searchRadius: maxDistanceKm, searchRadiusUnit: 'km' },
        properties: filteredProps,
        total: filteredProps.length
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
    const coords = await resolveCoordinates(req);
    const { latitude, longitude } = coords;
    const city = (await resolveCityForSearch(req, coords)) || undefined;
    const maxDistanceKm = Math.min(parseFloat(req.query.maxDistance) || 10, 10);
    const maxDistance = maxDistanceKm * 1000;
    const debug = (process.env.NEARBY_DEBUG === '1') || (req.query.debug === '1');

    const vehicles = await findNearbyVehicles(latitude, longitude, maxDistance, city, debug);
    const filteredVehs = city ? vehicles.filter(v => cityEquals(v?.location?.city, city)) : vehicles;

    res.json({
      success: true,
      data: {
        location: { latitude, longitude, city, coordinateSource: coords.source, searchRadius: maxDistanceKm, searchRadiusUnit: 'km' },
        vehicles: filteredVehs,
        total: filteredVehs.length
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
