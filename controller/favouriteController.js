import User from '../models/user.js';
import Property from '../models/property.js';
import Vehicle from '../models/vehicle.js';

/**
 * Add property to user's favourites
 * POST /api/favourite/property/:id
 */
export const addPropertyToFavourites = async (req, res) => {
  try {
    const userId = req.user?.id || req.body.userId; // Assuming auth middleware sets req.user
    const propertyId = req.params.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User authentication required'
      });
    }

    // Check if property exists
    const property = await Property.findById(propertyId);
    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    // Update user's favourites
    const user = await User.findByIdAndUpdate(
      userId,
      { $addToSet: { 'favourites.properties': propertyId } }, // $addToSet prevents duplicates
      { new: true, select: 'favourites' }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'Property added to favourites',
      data: {
        favourites: user.favourites
      }
    });

  } catch (error) {
    console.error('Error adding property to favourites:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to add property to favourites'
    });
  }
};

/**
 * Add vehicle to user's favourites
 * POST /api/favourite/vehicle/:id
 */
export const addVehicleToFavourites = async (req, res) => {
  try {
    const userId = req.user?.id || req.body.userId;
    const vehicleId = req.params.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User authentication required'
      });
    }

    // Check if vehicle exists
    const vehicle = await Vehicle.findById(vehicleId);
    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found'
      });
    }

    // Update user's favourites
    const user = await User.findByIdAndUpdate(
      userId,
      { $addToSet: { 'favourites.vehicles': vehicleId } },
      { new: true, select: 'favourites' }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'Vehicle added to favourites',
      data: {
        favourites: user.favourites
      }
    });

  } catch (error) {
    console.error('Error adding vehicle to favourites:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to add vehicle to favourites'
    });
  }
};

/**
 * Remove property from user's favourites
 * DELETE /api/favourite/property/:id
 */
export const removePropertyFromFavourites = async (req, res) => {
  try {
    const userId = req.user?.id || req.body.userId;
    const propertyId = req.params.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User authentication required'
      });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { $pull: { 'favourites.properties': propertyId } },
      { new: true, select: 'favourites' }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'Property removed from favourites',
      data: {
        favourites: user.favourites
      }
    });

  } catch (error) {
    console.error('Error removing property from favourites:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to remove property from favourites'
    });
  }
};

/**
 * Remove vehicle from user's favourites
 * DELETE /api/favourite/vehicle/:id
 */
export const removeVehicleFromFavourites = async (req, res) => {
  try {
    const userId = req.user?.id || req.body.userId;
    const vehicleId = req.params.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User authentication required'
      });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { $pull: { 'favourites.vehicles': vehicleId } },
      { new: true, select: 'favourites' }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'Vehicle removed from favourites',
      data: {
        favourites: user.favourites
      }
    });

  } catch (error) {
    console.error('Error removing vehicle from favourites:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to remove vehicle from favourites'
    });
  }
};

/**
 * Get all user's favourites
 * GET /api/favourite
 */
export const getUserFavourites = async (req, res) => {
  try {
    const userId = req.user?.id || req.query.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User authentication required'
      });
    }

    const user = await User.findById(userId)
      .populate({
        path: 'favourites.properties',
        select: '-__v',
        populate: { path: 'ownerId', select: 'name avatar phone' }
      })
      .populate({
        path: 'favourites.vehicles',
        select: '-__v',
        populate: { path: 'ownerId', select: 'name avatar phone' }
      })
      .select('favourites');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: {
        favourites: user.favourites,
        total: {
          properties: user.favourites.properties.length,
          vehicles: user.favourites.vehicles.length,
          all: user.favourites.properties.length + user.favourites.vehicles.length
        }
      }
    });

  } catch (error) {
    console.error('Error getting user favourites:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get user favourites'
    });
  }
};

/**
 * Get user's favourite properties only
 * GET /api/favourite/properties
 */
export const getUserFavouriteProperties = async (req, res) => {
  try {
    const userId = req.user?.id || req.query.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User authentication required'
      });
    }

    const user = await User.findById(userId)
      .populate({
        path: 'favourites.properties',
        select: '-__v',
        populate: { path: 'ownerId', select: 'name avatar phone' }
      })
      .select('favourites.properties');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: {
        properties: user.favourites.properties,
        total: user.favourites.properties.length
      }
    });

  } catch (error) {
    console.error('Error getting favourite properties:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get favourite properties'
    });
  }
};

/**
 * Get user's favourite vehicles only
 * GET /api/favourite/vehicles
 */
export const getUserFavouriteVehicles = async (req, res) => {
  try {
    const userId = req.user?.id || req.query.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User authentication required'
      });
    }

    const user = await User.findById(userId)
      .populate({
        path: 'favourites.vehicles',
        select: '-__v',
        populate: { path: 'ownerId', select: 'name avatar phone' }
      })
      .select('favourites.vehicles');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: {
        vehicles: user.favourites.vehicles,
        total: user.favourites.vehicles.length
      }
    });

  } catch (error) {
    console.error('Error getting favourite vehicles:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get favourite vehicles'
    });
  }
};

/**
 * Toggle property favourite status
 * POST /api/favourite/toggle/property/:id
 * Returns whether the property is now favourited or not
 */
export const togglePropertyFavourite = async (req, res) => {
  try {
    const userId = req.userId; // From authUser middleware
    const propertyId = req.params.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User authentication required'
      });
    }

    // Check if property exists
    const property = await Property.findById(propertyId);
    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    // Get current user favourites
    const user = await User.findById(userId).select('favourites');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if already in favourites
    const isCurrentlyFavourite = user.favourites?.properties?.some(
      id => id.toString() === propertyId
    );

    let updatedUser;
    let isFavourite;

    if (isCurrentlyFavourite) {
      // Remove from favourites
      updatedUser = await User.findByIdAndUpdate(
        userId,
        { $pull: { 'favourites.properties': propertyId } },
        { new: true, select: 'favourites' }
      );
      isFavourite = false;
    } else {
      // Add to favourites
      updatedUser = await User.findByIdAndUpdate(
        userId,
        { $addToSet: { 'favourites.properties': propertyId } },
        { new: true, select: 'favourites' }
      );
      isFavourite = true;
    }

    res.json({
      success: true,
      message: isFavourite ? 'Property added to favourites' : 'Property removed from favourites',
      data: {
        isFavourite,
        propertyId,
        favourites: updatedUser.favourites
      }
    });

  } catch (error) {
    console.error('Error toggling property favourite:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to toggle property favourite'
    });
  }
};

/**
 * Toggle vehicle favourite status
 * POST /api/favourite/toggle/vehicle/:id
 * Returns whether the vehicle is now favourited or not
 */
export const toggleVehicleFavourite = async (req, res) => {
  try {
    const userId = req.userId; // From authUser middleware
    const vehicleId = req.params.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User authentication required'
      });
    }

    // Check if vehicle exists
    const vehicle = await Vehicle.findById(vehicleId);
    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found'
      });
    }

    // Get current user favourites
    const user = await User.findById(userId).select('favourites');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if already in favourites
    const isCurrentlyFavourite = user.favourites?.vehicles?.some(
      id => id.toString() === vehicleId
    );

    let updatedUser;
    let isFavourite;

    if (isCurrentlyFavourite) {
      // Remove from favourites
      updatedUser = await User.findByIdAndUpdate(
        userId,
        { $pull: { 'favourites.vehicles': vehicleId } },
        { new: true, select: 'favourites' }
      );
      isFavourite = false;
    } else {
      // Add to favourites
      updatedUser = await User.findByIdAndUpdate(
        userId,
        { $addToSet: { 'favourites.vehicles': vehicleId } },
        { new: true, select: 'favourites' }
      );
      isFavourite = true;
    }

    res.json({
      success: true,
      message: isFavourite ? 'Vehicle added to favourites' : 'Vehicle removed from favourites',
      data: {
        isFavourite,
        vehicleId,
        favourites: updatedUser.favourites
      }
    });

  } catch (error) {
    console.error('Error toggling vehicle favourite:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to toggle vehicle favourite'
    });
  }
};

/**
 * Get user's favourite IDs only (lightweight for app startup)
 * GET /api/favourite/ids
 */
export const getUserFavouriteIds = async (req, res) => {
  try {
    const userId = req.userId; // From authUser middleware

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User authentication required'
      });
    }

    const user = await User.findById(userId).select('favourites');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Return just the IDs as strings
    const propertyIds = (user.favourites?.properties || []).map(id => id.toString());
    const vehicleIds = (user.favourites?.vehicles || []).map(id => id.toString());

    res.json({
      success: true,
      data: {
        properties: propertyIds,
        vehicles: vehicleIds,
        all: [...propertyIds, ...vehicleIds]
      }
    });

  } catch (error) {
    console.error('Error getting favourite IDs:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get favourite IDs'
    });
  }
};
