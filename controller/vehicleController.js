// controller/vehicleController.js
import Vehicle from '../models/vehicle.js';





export const searchItems = async (req, res) => {
  try {

    let search = req.search;
    console.log('🚗 Fetching featured vehicles...');

    let results = [];

    // Get all featured vehicles (removed limit to show all)
    if(!search)
    results = await Vehicle.find({
      Featured: true
    });
    else{
      search = search.slice(0,-1).toLowerCase()
      results = await Vehicle.find({
        Featured: true,
        category: search
      });
    }
    
    console.log(`✅ Found ${results.length} featured vehicles`);

    res.status(200).json({
      success: true,
      count: results.length,
      results
    });

  } catch (error) {
    console.error('❌ Error fetching featured vehicles:', error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
// Get vehicle by ID
export const getVehicleById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.json({ success: false, message: 'Vehicle ID is required' });
    }

    const vehicle = await Vehicle.findById(id)
      .populate('ownerId', 'name email phone avatar');

    if (!vehicle) {
      return res.json({ success: false, message: 'Vehicle not found' });
    }

    return res.json({ 
      success: true, 
      vehicle 
    });

  } catch (error) {
    console.error('Error fetching vehicle:', error);
    res.json({ success: false, message: error.message });
  }
};
