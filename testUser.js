// testUser.js
import mongoose from 'mongoose';
import User from './models/User.js'; // make sure this path is correct

const propertyIds = [
  "690479dfd7491807e0e9c02e","690479dfd7491807e0e9c02f",
  "690479dfd7491807e0e9c030","690479dfd7491807e0e9c031",
  "690479dfd7491807e0e9c032","690479dfd7491807e0e9c033",
  "690479dfd7491807e0e9c034","690479dfd7491807e0e9c035",
  "690479dfd7491807e0e9c036","690479dfd7491807e0e9c037",
  "690479dfd7491807e0e9c038","690479dfd7491807e0e9c039",
  "690479dfd7491807e0e9c03a","690479dfd7491807e0e9c03b",
  "690479dfd7491807e0e9c03c","690479dfd7491807e0e9c03d",
  "690479dfd7491807e0e9c03e","690479dfd7491807e0e9c03f",
  "690479dfd7491807e0e9c040","690479dfd7491807e0e9c041"
];

function getRandomSubset(arr) {
  const shuffled = arr.sort(() => 0.5 - Math.random());
  const count = Math.floor(Math.random() * 6); // 0 to 5 items
  return shuffled.slice(0, count);
}

function randomString(length) {
  return Math.random().toString(36).substring(2, 2 + length);
}

async function seedUsers() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/rentaly');
    console.log("✅ Connected to MongoDB");

    await User.deleteMany({});
    console.log("⚠️ Cleared existing users");

    const users = [];

    for (let i = 0; i < 10; i++) {
      const name = `User${i + 1}`;
      const email = `user${i + 1}_${randomString(3)}@example.com`; // unique email
      const phone = `+1${Math.floor(1000000000 + Math.random() * 9000000000)}`;
      const avatar = `https://i.pravatar.cc/150?img=${i + 1}`;

      users.push({
        name,
        email,
        phone,
        password: 'hashed_password',
        favourites: {
          properties: getRandomSubset(propertyIds),
          vehicles: [] // can add vehicle ids if needed
        },
        bookings: {
          booked: getRandomSubset(propertyIds),
          inProgress: getRandomSubset(propertyIds),
          cancelled: getRandomSubset(propertyIds)
        }
      });
    }

    await User.insertMany(users);
    console.log("✅ 10 Users inserted successfully");

    await mongoose.connection.close();
    console.log("✅ Connection closed");
  } catch (err) {
    console.error("❌ Error seeding users:", err);
  }
}

seedUsers();
