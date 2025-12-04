// Quick script to check and populate test vehicles
import mongoose from 'mongoose';
import Vehicle from './models/vehicle.js';
import 'dotenv/config';

const MONGODB_URI = process.env.MONGODB_URI;

async function checkAndPopulateVehicles() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Check if we have any featured vehicles
        const featuredCount = await Vehicle.countDocuments({ Featured: true, available: true, status: 'active' });
        console.log(`📊 Featured vehicles in DB: ${featuredCount}`);

        const totalVehicles = await Vehicle.countDocuments();
        console.log(`📊 Total vehicles in DB: ${totalVehicles}`);

        if (totalVehicles === 0) {
            console.log('⚠️ No vehicles found! Creating sample data...');

            const sampleVehicles = [
                {
                    title: 'BMW X5 SUV - Premium',
                    vehicleType: 'car',
                    location: { type: 'Point', coordinates: [77.2090, 28.6139], city: 'Delhi', address: 'Connaught Place' },
                    pricePerDay: 5000,
                    pricePerHour: 500,
                    discountPercent: 10,
                    images: ['https://picsum.photos/800/600?random=1'],
                    seats: 5,
                    transmission: 'Automatic',
                    fuel: 'Petrol',
                    category: 'car',
                    rating: 4.8,
                    reviewCount: 45,
                    Featured: true,
                    available: true,
                    status: 'active',
                    ownerId: new mongoose.Types.ObjectId()
                },
                {
                    title: 'Honda Activa 125 - Scooter',
                    vehicleType: 'scooter',
                    location: { type: 'Point', coordinates: [77.2167, 28.6358], city: 'Delhi', address: 'Karol Bagh' },
                    pricePerDay: 500,
                    pricePerHour: 50,
                    discountPercent: 5,
                    images: ['https://picsum.photos/800/600?random=2'],
                    seats: 2,
                    transmission: 'Automatic',
                    fuel: 'Petrol',
                    category: 'scooter',
                    rating: 4.5,
                    reviewCount: 32,
                    Featured: true,
                    available: true,
                    status: 'active',
                    ownerId: new mongoose.Types.ObjectId()
                },
                {
                    title: 'Royal Enfield Classic 350',
                    vehicleType: 'bike',
                    location: { type: 'Point', coordinates: [77.2295, 28.6129], city: 'Delhi', address: 'Nehru Place' },
                    pricePerDay: 800,
                    pricePerHour: 80,
                    images: ['https://picsum.photos/800/600?random=3'],
                    seats: 2,
                    transmission: 'Manual',
                    fuel: 'Petrol',
                    category: 'bike',
                    rating: 4.7,
                    reviewCount: 28,
                    Featured: true,
                    available: true,
                    status: 'active',
                    ownerId: new mongoose.Types.ObjectId()
                },
                {
                    title: 'Maruti Eeco Van - 7 Seater',
                    vehicleType: 'van',
                    location: { type: 'Point', coordinates: [77.1025, 28.7041], city: 'Delhi', address: 'Rohini' },
                    pricePerDay: 2000,
                    pricePerHour: 200,
                    discountPercent: 15,
                    images: ['https://picsum.photos/800/600?random=4'],
                    seats: 7,
                    transmission: 'Manual',
                    fuel: 'CNG',
                    category: 'van',
                    rating: 4.3,
                    reviewCount: 18,
                    Featured: true,
                    available: true,
                    status: 'active',
                    ownerId: new mongoose.Types.ObjectId()
                },
                {
                    title: 'Tesla Model 3 - Electric',
                    vehicleType: 'car',
                    location: { type: 'Point', coordinates: [77.2273, 28.5355], city: 'Delhi', address: 'Saket' },
                    pricePerDay: 8000,
                    pricePerHour: 800,
                    images: ['https://picsum.photos/800/600?random=5'],
                    seats: 5,
                    transmission: 'Automatic',
                    fuel: 'Electric',
                    category: 'car',
                    rating: 4.9,
                    reviewCount: 56,
                    Featured: true,
                    available: true,
                    status: 'active',
                    ownerId: new mongoose.Types.ObjectId()
                }
            ];

            await Vehicle.insertMany(sampleVehicles);
            console.log(`✅ Created ${sampleVehicles.length} sample vehicles`);
        } else if (featuredCount === 0) {
            console.log('⚠️ Found vehicles but none are featured. Updating some to be featured...');
            await Vehicle.updateMany(
                { available: true, status: 'active' },
                { $set: { Featured: true } },
                { limit: 5 }
            );
            console.log('✅ Updated vehicles to featured');
        }

        await mongoose.disconnect();
        console.log('✅ Done!');
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

checkAndPopulateVehicles();
