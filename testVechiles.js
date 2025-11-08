// seedVehicles.js
import mongoose from "mongoose";
import { faker } from "@faker-js/faker";
import Vehicle from "./models/vehicle.js"; // adjust path if needed

// MongoDB connection
const MONGO_URI = "mongodb://localhost:27017/rentaly"; // change to your db
await mongoose.connect(MONGO_URI);
console.log("✅ Connected to MongoDB");

const vehicleTypes = ["car", "bike", "van", "scooter"];
const fuelTypes = ["petrol", "diesel", "electric", "hybrid"];
const transmissions = ["manual", "automatic"];
const statuses = ["active", "inactive", "suspended", "deleted"];

function randomPrice() {
  const perDay = faker.number.int({ min: 500, max: 5000 });
  return {
    perHour: Math.round(perDay / 24),
    perDay,
    currency: "INR",
    securityDeposit: faker.number.int({ min: 1000, max: 10000 }),
  };
}

function randomLocation() {
  const city = faker.location.city();
  const state = faker.location.state();
  const country = "India";
  const postalCode = faker.location.zipCode("######");
  const lat = faker.location.latitude({ min: 8, max: 37 });
  const lng = faker.location.longitude({ min: 68, max: 97 });
  return {
    type: "Point",
    coordinates: [lng, lat],
    address: faker.location.streetAddress(),
    city,
    state,
    country,
    postalCode,
  };
}

function createFakeVehicle() {
  const vehicleType = faker.helpers.arrayElement(vehicleTypes);
  return {
    ownerId: new mongoose.Types.ObjectId(),
    make: faker.vehicle.manufacturer(),
    model: faker.vehicle.model(),
    year: faker.number.int({ min: 2000, max: 2025 }),
    vehicleType,
    fuelType: faker.helpers.arrayElement(fuelTypes),
    transmission: faker.helpers.arrayElement(transmissions),
    seats: vehicleType === "bike" || vehicleType === "scooter"
      ? faker.number.int({ min: 1, max: 2 })
      : faker.number.int({ min: 2, max: 8 }),
    color: faker.vehicle.color(),
    mileage: faker.number.int({ min: 5000, max: 150000 }),
    price: randomPrice(),
    Featured: faker.datatype.boolean(),
    location: randomLocation(),
    photos: Array.from({ length: faker.number.int({ min: 1, max: 5 }) }, () =>
      faker.image.urlLoremFlickr({ category: "vehicle" })
    ),
    rating: {
      avg: faker.number.float({ min: 3, max: 5, precision: 0.1 }),
      count: faker.number.int({ min: 0, max: 500 }),
    },
    status: faker.helpers.arrayElement(statuses),
    available: faker.datatype.boolean(),
  };
}

async function seed() {
  const vehicles = Array.from({ length: 100 }, createFakeVehicle);
  await Vehicle.insertMany(vehicles);
  console.log("✅ Inserted 100 fake vehicles");
  await mongoose.disconnect();
  console.log("🚪 Disconnected from MongoDB");
}

seed().catch((err) => {
  console.error(err);
  mongoose.disconnect();
});
