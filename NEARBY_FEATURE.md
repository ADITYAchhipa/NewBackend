# Nearby Location Feature Documentation

## Overview

The **Nearby** feature allows users to discover properties and vehicles near their current location using MongoDB's geospatial queries. When a user opens the app, their location is fetched once and used to show nearby listings.

## How It Works

```
User Opens App → Get Location → Send to Backend → Find Nearby Listings → Return Results
```

### Flow:
1. **Frontend**: User opens app → Get device location (latitude, longitude)
2. **Backend**: Receives coordinates → Queries MongoDB with geospatial indexes
3. **Database**: Returns properties/vehicles within specified radius
4. **Backend**: Calculates distances → Sorts by proximity → Returns to frontend
5. **Frontend**: Displays nearby listings with distance information

## API Endpoints

### 1. Get All Nearby Listings (Properties + Vehicles)

```http
GET /api/nearby?latitude=28.6139&longitude=77.2090&maxDistance=10&type=all
```

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `latitude` | Number | ✅ Yes | - | User's latitude (-90 to 90) |
| `longitude` | Number | ✅ Yes | - | User's longitude (-180 to 180) |
| `maxDistance` | Number | ❌ No | 10 | Search radius in kilometers |
| `type` | String | ❌ No | 'all' | Filter: 'properties', 'vehicles', or 'all' |

**Example Request:**
```bash
curl "http://localhost:4000/api/nearby?latitude=28.6139&longitude=77.2090&maxDistance=5"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "location": {
      "latitude": 28.6139,
      "longitude": 77.2090,
      "searchRadius": 5,
      "searchRadiusUnit": "km"
    },
    "properties": [
      {
        "_id": "...",
        "title": "Luxury 2BHK Apartment",
        "category": "apartment",
        "price": {
          "perMonth": 25000,
          "currency": "INR"
        },
        "locationGeo": {
          "type": "Point",
          "coordinates": [77.2100, 28.6150]
        },
        "address": "Sector 15, Delhi",
        "images": ["..."],
        "distance": 1.23,
        "distanceUnit": "km",
        "ownerId": {
          "name": "John Doe",
          "avatar": "...",
          "phone": "..."
        }
      }
    ],
    "vehicles": [
      {
        "_id": "...",
        "make": "Honda",
        "model": "City",
        "year": 2022,
        "vehicleType": "car",
        "price": {
          "perDay": 1500,
          "currency": "INR"
        },
        "location": {
          "type": "Point",
          "coordinates": [77.2080, 28.6120],
          "city": "Delhi"
        },
        "distance": 0.85,
        "distanceUnit": "km"
      }
    ],
    "total": {
      "properties": 12,
      "vehicles": 8,
      "all": 20
    }
  },
  "message": "Nearby listings fetched successfully"
}
```

### 2. Get Only Nearby Properties

```http
GET /api/nearby/properties?latitude=28.6139&longitude=77.2090&maxDistance=5
```

**Response:**
```json
{
  "success": true,
  "data": {
    "location": {
      "latitude": 28.6139,
      "longitude": 77.2090,
      "searchRadius": 5,
      "searchRadiusUnit": "km"
    },
    "properties": [...],
    "total": 12
  }
}
```

### 3. Get Only Nearby Vehicles

```http
GET /api/nearby/vehicles?latitude=28.6139&longitude=77.2090&maxDistance=5
```

**Response:**
```json
{
  "success": true,
  "data": {
    "location": {
      "latitude": 28.6139,
      "longitude": 77.2090,
      "searchRadius": 5,
      "searchRadiusUnit": "km"
    },
    "vehicles": [...],
    "total": 8
  }
}
```

## Flutter Integration

### 1. Get User Location (Run Once on App Start)

```dart
// lib/services/location_service.dart
import 'package:geolocator/geolocator.dart';

class LocationService {
  Future<Position?> getCurrentLocation() async {
    // Check if location services are enabled
    bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      return null;
    }

    // Request permission
    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) {
        return null;
      }
    }

    // Get current position
    Position position = await Geolocator.getCurrentPosition(
      desiredAccuracy: LocationAccuracy.high
    );

    return position;
  }
}
```

### 2. Fetch Nearby Listings

```dart
// lib/services/nearby_service.dart
import 'package:http/http.dart' as http;
import 'dart:convert';

class NearbyService {
  final String baseUrl = 'http://localhost:4000/api/nearby';

  Future<Map<String, dynamic>> getNearbyListings({
    required double latitude,
    required double longitude,
    double maxDistance = 10.0,
    String type = 'all'
  }) async {
    final uri = Uri.parse(baseUrl).replace(queryParameters: {
      'latitude': latitude.toString(),
      'longitude': longitude.toString(),
      'maxDistance': maxDistance.toString(),
      'type': type,
    });

    final response = await http.get(uri);

    if (response.statusCode == 200) {
      return json.decode(response.body);
    } else {
      throw Exception('Failed to load nearby listings');
    }
  }

  Future<List<dynamic>> getNearbyProperties({
    required double latitude,
    required double longitude,
    double maxDistance = 10.0,
  }) async {
    final uri = Uri.parse('$baseUrl/properties').replace(queryParameters: {
      'latitude': latitude.toString(),
      'longitude': longitude.toString(),
      'maxDistance': maxDistance.toString(),
    });

    final response = await http.get(uri);

    if (response.statusCode == 200) {
      final data = json.decode(response.body);
      return data['data']['properties'];
    } else {
      throw Exception('Failed to load nearby properties');
    }
  }

  Future<List<dynamic>> getNearbyVehicles({
    required double latitude,
    required double longitude,
    double maxDistance = 10.0,
  }) async {
    final uri = Uri.parse('$baseUrl/vehicles').replace(queryParameters: {
      'latitude': latitude.toString(),
      'longitude': longitude.toString(),
      'maxDistance': maxDistance.toString(),
    });

    final response = await http.get(uri);

    if (response.statusCode == 200) {
      final data = json.decode(response.body);
      return data['data']['vehicles'];
    } else {
      throw Exception('Failed to load nearby vehicles');
    }
  }
}
```

### 3. Example Usage in Flutter Widget

```dart
// lib/screens/nearby_screen.dart
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';

class NearbyScreen extends StatefulWidget {
  @override
  _NearbyScreenState createState() => _NearbyScreenState();
}

class _NearbyScreenState extends State<NearbyScreen> {
  final LocationService _locationService = LocationService();
  final NearbyService _nearbyService = NearbyService();
  
  bool _isLoading = true;
  List<dynamic> _properties = [];
  List<dynamic> _vehicles = [];
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadNearbyListings();
  }

  Future<void> _loadNearbyListings() async {
    try {
      setState(() {
        _isLoading = true;
        _error = null;
      });

      // Get user's current location
      Position? position = await _locationService.getCurrentLocation();
      
      if (position == null) {
        setState(() {
          _error = 'Could not get your location. Please enable location services.';
          _isLoading = false;
        });
        return;
      }

      // Fetch nearby listings
      final result = await _nearbyService.getNearbyListings(
        latitude: position.latitude,
        longitude: position.longitude,
        maxDistance: 10.0, // 10 km radius
        type: 'all'
      );

      setState(() {
        _properties = result['data']['properties'];
        _vehicles = result['data']['vehicles'];
        _isLoading = false;
      });

    } catch (e) {
      setState(() {
        _error = 'Failed to load nearby listings: $e';
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return Scaffold(
        appBar: AppBar(title: Text('Nearby')),
        body: Center(child: CircularProgressIndicator()),
      );
    }

    if (_error != null) {
      return Scaffold(
        appBar: AppBar(title: Text('Nearby')),
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(_error!),
              SizedBox(height: 16),
              ElevatedButton(
                onPressed: _loadNearbyListings,
                child: Text('Retry'),
              ),
            ],
          ),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: Text('Nearby Listings'),
        actions: [
          IconButton(
            icon: Icon(Icons.refresh),
            onPressed: _loadNearbyListings,
          ),
        ],
      ),
      body: ListView(
        children: [
          if (_properties.isNotEmpty) ...[
            Padding(
              padding: EdgeInsets.all(16),
              child: Text('Properties Near You',
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
            ),
            ListView.builder(
              shrinkWrap: true,
              physics: NeverScrollableScrollPhysics(),
              itemCount: _properties.length,
              itemBuilder: (context, index) {
                final property = _properties[index];
                return ListTile(
                  title: Text(property['title']),
                  subtitle: Text('${property['distance']} ${property['distanceUnit']} away'),
                  trailing: Text('₹${property['price']['perMonth']}/mo'),
                );
              },
            ),
          ],
          if (_vehicles.isNotEmpty) ...[
            Padding(
              padding: EdgeInsets.all(16),
              child: Text('Vehicles Near You',
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
            ),
            ListView.builder(
              shrinkWrap: true,
              physics: NeverScrollableScrollPhysics(),
              itemCount: _vehicles.length,
              itemBuilder: (context, index) {
                final vehicle = _vehicles[index];
                return ListTile(
                  title: Text('${vehicle['make']} ${vehicle['model']}'),
                  subtitle: Text('${vehicle['distance']} ${vehicle['distanceUnit']} away'),
                  trailing: Text('₹${vehicle['price']['perDay']}/day'),
                );
              },
            ),
          ],
          if (_properties.isEmpty && _vehicles.isEmpty)
            Center(
              child: Padding(
                padding: EdgeInsets.all(32),
                child: Text('No listings found nearby'),
              ),
            ),
        ],
      ),
    );
  }
}
```

## Database Requirements

### Ensure Geospatial Indexes Exist

The models already have 2dsphere indexes defined, but verify they're created:

```javascript
// For Property model
db.properties.createIndex({ "locationGeo.coordinates": "2dsphere" })

// For Vehicle model
db.vehicles.createIndex({ "location.coordinates": "2dsphere" })
```

### Sample Data with Location

When creating properties or vehicles, ensure coordinates are in correct format:

```javascript
// Property with location
{
  title: "Luxury Apartment",
  locationGeo: {
    type: "Point",
    coordinates: [77.2090, 28.6139] // [longitude, latitude]
  },
  city: "Delhi",
  // ... other fields
}

// Vehicle with location
{
  make: "Honda",
  model: "City",
  location: {
    type: "Point",
    coordinates: [77.2090, 28.6139], // [longitude, latitude]
    city: "Delhi"
  },
  // ... other fields
}
```

## Features

✅ **Geospatial Search**: Uses MongoDB's $near operator with 2dsphere indexes
✅ **Distance Calculation**: Haversine formula for accurate distances
✅ **Configurable Radius**: Default 10km, customizable via query param
✅ **Type Filtering**: Get properties, vehicles, or both
✅ **Sorted by Distance**: Results automatically sorted by proximity
✅ **Owner Details**: Populated with owner information
✅ **Active Only**: Filters out inactive/unavailable listings
✅ **Limited Results**: Max 50 per category to avoid performance issues

## Performance Tips

1. **Indexes**: Ensure 2dsphere indexes exist on coordinate fields
2. **Limit Results**: Default limit of 50 items per category
3. **Active Only**: Only queries active and available listings
4. **Lean Queries**: Uses `.lean()` for faster JSON responses
5. **Parallel Queries**: Fetches properties and vehicles simultaneously

## Coordinates Format

⚠️ **Important**: MongoDB GeoJSON requires [longitude, latitude] order (opposite of common lat/lng):

- ✅ Correct: `[77.2090, 28.6139]` (longitude first)
- ❌ Wrong: `[28.6139, 77.2090]` (latitude first)

## Error Handling

The API validates:
- Latitude range: -90 to 90
- Longitude range: -180 to 180
- Coordinate format: Must be valid numbers
- Returns 400 Bad Request with error message if validation fails

## Testing

```bash
# Test nearby endpoint
curl "http://localhost:4000/api/nearby?latitude=28.6139&longitude=77.2090&maxDistance=5"

# Test properties only
curl "http://localhost:4000/api/nearby/properties?latitude=28.6139&longitude=77.2090"

# Test vehicles only
curl "http://localhost:4000/api/nearby/vehicles?latitude=28.6139&longitude=77.2090"
```

## Next Steps

- [ ] Add Flutter location permission handling
- [ ] Implement location caching (don't fetch on every app open)
- [ ] Add "refresh location" button
- [ ] Add map view for nearby listings
- [ ] Implement filters (price range, category, etc.)
- [ ] Add authentication if needed
- [ ] Cache results for offline viewing
