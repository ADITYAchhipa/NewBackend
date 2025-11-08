import mongoose from "mongoose";
import Property from "./models/property.js";

// === MongoDB Connection ===
const DB_NAME = "rentaly"; // change to "rentaly" if you prefer
const MONGO_URI = `mongodb://localhost:27017/${DB_NAME}`;

try {
  await mongoose.connect(MONGO_URI);
  console.log(`✅ Connected to MongoDB database: ${DB_NAME}`);
} catch (err) {
  console.error("❌ MongoDB Connection Error:", err);
  process.exit(1);
}

// === Helper Data ===
const categories = ["apartment", "house", "villa", "condo", "studio", "pg", "guest_house", "land", "office", "shared_room"];
const cities = ["Udaipur", "Jaipur", "Delhi", "Mumbai", "Bangalore", "Pune", "Chennai", "Hyderabad", "Kolkata"];
const furnishedOptions = ["unfurnished", "semi-furnished", "furnished"];
const houseTypes = ["1BHK", "2BHK", "3BHK", "4BHK", "5BHK", "studio", "duplex", "penthouse", "villa", "shared"];
const amenitiesList = ["parking", "lift", "powerBackup", "swimmingPool", "gym", "garden", "wifi", "security"];
const bookingTypes = ["rent", "sale", "lease"];

// === Helper Functions ===
const randomItem = arr => arr[Math.floor(Math.random() * arr.length)];
const randomNumber = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomAmenities = () => amenitiesList.sort(() => 0.5 - Math.random()).slice(0, randomNumber(2, 5));

const fakeOwnerId = new mongoose.Types.ObjectId(); // replace with a real user ID if needed

// === Generate 100 Fake Properties ===
const properties = Array.from({ length: 100 }).map((_, i) => {
  const category = randomItem(categories);
  const city = randomItem(cities);
  const lat = 24 + Math.random();
  const lng = 73 + Math.random();

  return {
    ownerId: fakeOwnerId,
    title: `${category.charAt(0).toUpperCase() + category.slice(1)} in ${city}`,
    description: `Beautiful ${category} located in ${city} with modern amenities.`,
    category,
    price: {
      perMonth: randomNumber(5000, 50000),
      perDay: randomNumber(500, 2000),
      securityDeposit: randomNumber(2000, 10000),
    },
    address: `${randomNumber(1, 100)}, Main Street, ${city}`,
    city,
    state: "Rajasthan",
    country: "India",
    postalCode: `3130${randomNumber(10, 99)}`,
    locationGeo: { type: "Point", coordinates: [lng, lat] },
    images: [`https://picsum.photos/seed/${i}/400/300`],
    bedrooms: randomNumber(1, 5),
    bathrooms: randomNumber(1, 3),
    areaSqft: randomNumber(500, 2500),
    furnished: randomItem(furnishedOptions),
    amenities: randomAmenities(),
    houseDetails: category === "house" ? {
      houseType: randomItem(houseTypes),
      separateWashroom: Math.random() < 0.5,
      floor: randomNumber(1, 3),
      totalFloors: randomNumber(3, 10),
      plotSizeSqft: randomNumber(1000, 3000),
    } : undefined,
    status: "active",
    available: true,
    Featured: Math.random() < 0.1,
    bookingType: randomItem(bookingTypes),
    rating: { avg: randomNumber(1, 5), count: randomNumber(1, 50) },
    rules: ["noSmoking", "noPets"].filter(() => Math.random() < 0.5),
    meta: { views: randomNumber(10, 1000), tags: ["new", "featured", "popular"].filter(() => Math.random() < 0.5) },
  };
});

try {
  const result = await Property.insertMany(properties);
  console.log(`🎉 Inserted ${result.length} properties successfully!`);
} catch (err) {
  console.error("❌ Insert failed:", err);
}

await mongoose.disconnect();
console.log("🔌 Disconnected from MongoDB");
