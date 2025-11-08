// controllers/search.controller.js
import Vehicle from '../models/vehicle.js';
import Property from '../models/property.js';

export const searchItems = async (req, res) => {
  try {
    const { query, type } = req.query; // type = 'vehicle' or 'property'

    if (!type || !query)
      return res.status(400).json({ success: false, message: "Type and query are required" });

    let results = [];

    if (type === 'vehicle') {
      results = await Vehicle.find({
        $text: { $search: query }
      });
    } else if (type === 'property') {
      results = await Property.find({
        $text: { $search: query }
      });
    } else {
      return res.status(400).json({ success: false, message: "Invalid type parameter" });
    }

    res.status(200).json({
      success: true,
      count: results.length,
      results
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
