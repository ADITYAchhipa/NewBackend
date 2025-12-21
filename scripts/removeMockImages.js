/**
 * Database Migration Script
 * Removes mock-storage.com image URLs from properties and vehicles
 * 
 * Run this script once to clean up old mock URLs:
 * node backend/scripts/removeMockImages.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Property from '../models/property.js';
import Vehicle from '../models/vehicle.js';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/rentaly';

async function removeMockImages() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(MONGO_URI);
        console.log('✅ Connected to MongoDB');

        // Update properties - remove mock images and set to empty array
        console.log('\n📋 Cleaning property images...');
        const propertyResult = await Property.updateMany(
            {
                $or: [
                    { image: { $regex: 'mock-storage.com' } },
                    { images: { $elemMatch: { $regex: 'mock-storage.com' } } }
                ]
            },
            {
                $set: {
                    image: '',
                    images: []
                }
            }
        );
        console.log(`✅ Updated ${propertyResult.modifiedCount} properties`);

        // Update vehicles - remove mock images
        console.log('\n🚗 Cleaning vehicle images...');
        const vehicleResult = await Vehicle.updateMany(
            {
                $or: [
                    { image: { $regex: 'mock-storage.com' } },
                    { images: { $elemMatch: { $regex: 'mock-storage.com' } } }
                ]
            },
            {
                $set: {
                    image: '',
                    images: []
                }
            }
        );
        console.log(`✅ Updated ${vehicleResult.modifiedCount} vehicles`);

        // Also update placeholder images from via.placeholder.com
        console.log('\n🖼️  Cleaning placeholder images...');
        const placeholderPropertyResult = await Property.updateMany(
            {
                $or: [
                    { image: { $regex: 'via.placeholder.com' } },
                    { images: { $elemMatch: { $regex: 'via.placeholder.com' } } }
                ]
            },
            {
                $set: {
                    image: '',
                    images: []
                }
            }
        );
        console.log(`✅ Updated ${placeholderPropertyResult.modifiedCount} properties with placeholders`);

        const placeholderVehicleResult = await Vehicle.updateMany(
            {
                $or: [
                    { image: { $regex: 'via.placeholder.com' } },
                    { images: { $elemMatch: { $regex: 'via.placeholder.com' } } }
                ]
            },
            {
                $set: {
                    image: '',
                    images: []
                }
            }
        );
        console.log(`✅ Updated ${placeholderVehicleResult.modifiedCount} vehicles with placeholders`);

        console.log('\n✨ Migration complete!');
        console.log('\n📝 Summary:');
        console.log(`   Properties cleaned: ${propertyResult.modifiedCount + placeholderPropertyResult.modifiedCount}`);
        console.log(`   Vehicles cleaned: ${vehicleResult.modifiedCount + placeholderVehicleResult.modifiedCount}`);
        console.log('\n💡 Note: Affected listings now have empty images array.');
        console.log('   Users should re-upload images for these listings.');

        await mongoose.connection.close();
        console.log('\n🔌 Database connection closed');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration error:', error);
        await mongoose.connection.close();
        process.exit(1);
    }
}

removeMockImages();
