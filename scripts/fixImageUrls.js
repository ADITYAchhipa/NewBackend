/**
 * Fix relative image URLs in database
 * Converts /uploads/images/... to http://localhost:4000/uploads/images/...
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Property from '../models/property.js';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/rentaly';

async function fixImageUrls() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(MONGO_URI);
        console.log('✅ Connected');

        // Find all properties with relative URLs (starting with /)
        const properties = await Property.find({
            $or: [
                { image: { $regex: '^/' } },
                { images: { $elemMatch: { $regex: '^/' } } }
            ]
        });

        console.log(`\n📋 Found ${properties.length} properties with relative URLs`);

        let fixed = 0;
        for (const property of properties) {
            let updated = false;

            // Fix main image
            if (property.image && property.image.startsWith('/')) {
                property.image = `http://localhost:4000${property.image}`;
                updated = true;
            }

            // Fix images array
            if (property.images && property.images.length > 0) {
                property.images = property.images.map(img =>
                    img.startsWith('/') ? `http://localhost:4000${img}` : img
                );
                updated = true;
            }

            if (updated) {
                await property.save();
                fixed++;
                console.log(`✅ Fixed: ${property.title}`);
            }
        }

        console.log(`\n✨ Migration complete! Fixed ${fixed} properties`);
        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration error:', error);
        await mongoose.connection.close();
        process.exit(1);
    }
}

fixImageUrls();
