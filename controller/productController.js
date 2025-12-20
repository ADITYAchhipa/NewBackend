import { v2 as cloudinary } from 'cloudinary';
import Property from '../models/property.js';
import Vehicle from '../models/vehicle.js';
import fs from 'fs';
//ad product : /api/product/add

export const addProperty = async (req, res) => {
    try {
        let productData = JSON.parse(req.body.productData);

        const images = req.files;

        let imagesUrl = await Promise.all(
            images.map(async (image) => {
                let result = await cloudinary.uploader.upload(image.path, {
                    resource_type: 'image',
                    fetch_format: 'auto', // Equivalent to f_auto
                    quality: 'auto', // Equivalent to q_auto
                    transformation: [
                        { width: 4000, height: 4000, crop: 'limit' } // Prevent large images
                    ]
                })

                // Clean up temporary file after successful upload
                try {
                    fs.unlinkSync(image.path);
                } catch (err) {
                    console.log('Could not delete temp file:', err.message);
                }

                return result.secure_url;
            })
        );

        // SECURITY: Use allowlist to prevent mass assignment attacks
        // Never spread productData directly - attacker could inject ownerId, Featured, status, etc.
        const allowedFields = {
            title: productData.title,
            description: productData.description,
            category: productData.category,
            categoryType: productData.categoryType,
            address: productData.address,
            city: productData.city,
            state: productData.state,
            country: productData.country,
            postalCode: productData.postalCode,
            bedrooms: productData.bedrooms,
            bathrooms: productData.bathrooms,
            areaSqft: productData.areaSqft,
            furnished: productData.furnished,
            amenities: productData.amenities,
            essentialAmenities: productData.essentialAmenities,
            nearbyFacilities: productData.nearbyFacilities,
            prefrences: productData.prefrences,
            rules: productData.rules,
            bookingType: productData.bookingType,
            gateClosingTime: productData.gateClosingTime,
            price: productData.price,
            houseDetails: productData.houseDetails,
            locationGeo: productData.locationGeo,
            // Server-controlled fields (never from client):
            // ownerId: set from req.userId
            // Featured: always false for new listings
            // status: always 'active' by default
            // rating: always 0 by default
            // available: always true by default
        };

        await Property.create({
            ...allowedFields,
            images: imagesUrl,
            ownerId: req.userId, // Always from authenticated user
            status: 'active',
            available: true,
            Featured: false // Must be set by admin later
        });

        res.json({ success: true, message: "Product Added Successfully" });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
}


export const addVechile = async (req, res) => {
    try {
        let productData = JSON.parse(req.body.productData);

        const images = req.files;

        let imagesUrl = await Promise.all(
            images.map(async (image) => {
                let result = await cloudinary.uploader.upload(image.path, {
                    resource_type: 'image',
                    fetch_format: 'auto', // Equivalent to f_auto
                    quality: 'auto', // Equivalent to q_auto
                    transformation: [
                        { width: 4000, height: 4000, crop: 'limit' } // Prevent large images
                    ]
                })

                // Clean up temporary file after successful upload
                try {
                    fs.unlinkSync(image.path);
                } catch (err) {
                    console.log('Could not delete temp file:', err.message);
                }

                return result.secure_url;
            })
        );

        // SECURITY: Use allowlist to prevent mass assignment attacks
        const allowedFields = {
            name: productData.name,
            description: productData.description,
            vehicleType: productData.vehicleType,
            model: productData.model,
            year: productData.year,
            fueltype: productData.fueltype,
            transmission: productData.transmission,
            seating_capacity: productData.seating_capacity,
            mileage: productData.mileage,
            address: productData.address,
            city: productData.city,
            state: productData.state,
            country: productData.country,
            postalCode: productData.postalCode,
            amenities: productData.amenities,
            rules: productData.rules,
            price: productData.price,
            locationGeo: productData.locationGeo,
            // Server-controlled fields never from client
        };

        await Vehicle.create({
            ...allowedFields,
            photos: imagesUrl,
            ownerId: req.userId, // Always from authenticated user
            status: 'active',
            available: true,
            Featured: false // Must be set by admin
        });

        res.json({ success: true, message: "Product Added Successfully" });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
}

