import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import connectDB from './config/db.js';
import 'dotenv/config';
import connectCloudinary from './config/cloudinary.js';
// import sellerRoutes from './routes/searchRoutes.js';
import sellerRoutes from './routes/sellerRoutes.js';
import searchrouter from './routes/searchRoutes.js';
import userRouter from './routes/userRoutes.js';
import notificationRouter from './routes/notificationRoutes.js';
import nearbyRouter from './routes/nearbyRoutes.js';
import featuredRouter from './routes/featuredRoutes.js';
import favouriteRouter from './routes/favouriteRoutes.js';
import reviewRouter from './routes/reviewRoutes.js';
import propertyRouter from './routes/propertyRoutes.js';
import vehicleRouter from './routes/vehicleRoutes.js';
import AddItems from './routes/AddItems.js';
import disputeRouter from './routes/disputeRoutes.js';
import visitedRoutes from './routes/visitedRoutes.js';
import recommendedRoutes from './routes/recommendedRoutes.js';
const app = express();


app.use(express.json()); // parse JSON
app.use(cors({ origin: true, credentials: true })); // enable CORS with credentials

const port = process.env.PORT || 4000;

await connectDB();
await connectCloudinary();


// Middleware
app.use(express.urlencoded({ extended: true })); // for form-data
app.use(cookieParser());



// Routes
app.get('/', (req, res) => res.send('Hello World!'));
app.use('/api/seller', sellerRoutes)
app.use('/api/user', userRouter)
app.use('/api/search', searchrouter)
app.use('/api/notifications', notificationRouter)
app.use('/api/nearby', nearbyRouter)
app.use('/api/featured', featuredRouter)
app.use('/api/favourite', favouriteRouter)
app.use('/api/review', reviewRouter)
app.use('/api/property', propertyRouter)
app.use('/api/vehicle', vehicleRouter)
app.use('/api/addItems', AddItems)
app.use('/api/disputes', disputeRouter)
app.use('/api/user/visited', visitedRoutes); // Recently visited properties
app.use('/api/recommended', recommendedRoutes); // Personalized recommendations


app.listen(port, () => console.log(`✅ Server running at http://localhost:${port}`));
