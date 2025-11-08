// controller/propertyController.js
import Property from '../models/property.js';



export const searchItems = async (req, res) => {
  try {
    console.log('🏠 Fetching featured properties...');
    let { category } = req.query;
   
    console.log(category)
    let results = [];

    // Get all featured properties (removed limit to show all)
    if(!category)
    results = await Property.find({Featured: true});
  else{
     category=category.slice(0,-1).toLowerCase()
     console.log(category)  
    results = await Property.find({Featured: true,category:category});
  }

    
    console.log(`✅ Found ${results.length} featured properties`);

    res.status(200).json({
      success: true,
      count: results.length,
      results
    });

  } catch (error) {
    console.error('❌ Error fetching featured properties:', error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Get property by ID
export const getPropertyById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.json({ success: false, message: 'Property ID is required' });
    }

    const property = await Property.findById(id)
      .populate('ownerId', 'name email phone avatar');

    if (!property) {
      return res.json({ success: false, message: 'Property not found' });
    }

    // Increment view count
    property.meta.views = (property.meta.views || 0) + 1;
    await property.save();

    return res.json({ 
      success: true, 
      property 
    });

  } catch (error) {
    console.error('Error fetching property:', error);
    res.json({ success: false, message: error.message });
  }
};
