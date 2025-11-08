// Script to rebuild MongoDB indexes after schema changes
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Property from '../models/property.js';
import Vehicle from '../models/vehicle.js';

dotenv.config();

const rebuildIndexes = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Drop and rebuild Property indexes
    console.log('\n📋 Rebuilding Property indexes...');
    await Property.collection.dropIndexes();
    await Property.createIndexes();
    console.log('✅ Property indexes rebuilt successfully');

    // Drop and rebuild Vehicle indexes
    console.log('\n📋 Rebuilding Vehicle indexes...');
    await Vehicle.collection.dropIndexes();
    await Vehicle.createIndexes();
    console.log('✅ Vehicle indexes rebuilt successfully');

    // Display the created indexes
    console.log('\n📊 Property Indexes:');
    const propertyIndexes = await Property.collection.getIndexes();
    console.log(JSON.stringify(propertyIndexes, null, 2));

    console.log('\n📊 Vehicle Indexes:');
    const vehicleIndexes = await Vehicle.collection.getIndexes();
    console.log(JSON.stringify(vehicleIndexes, null, 2));

    console.log('\n✅ All indexes rebuilt successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error rebuilding indexes:', error);
    process.exit(1);
  }
};

rebuildIndexes();
