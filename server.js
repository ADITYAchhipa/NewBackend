import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
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
import visitedVehiclesRoutes from './routes/visitedVehiclesRoutes.js';
import recommendedRoutes from './routes/recommendedRoutes.js';
import ownerRouter from './routes/ownerRoutes.js';
import identityVerificationRouter from './routes/identityVerificationRoutes.js';
import filterRouter from './routes/filterRoutes.js';
import chatRouter from './routes/chatRoutes.js';

const app = express();
const server = createServer(app);

// Socket.io setup
const io = new Server(server, {
    cors: {
        origin: true,
        credentials: true
    }
});

// Store online users: { odId: socketId }
const userSocketMap = {};

// Make io and userSocketMap available to routes
app.set('io', io);
app.set('userSocketMap', userSocketMap);

// Export for use in other files
export { io, userSocketMap };

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log('🔌 User connected:', socket.id);

    // Get userId from query params (sent by client on connect)
    const userId = socket.handshake.query.userId;
    if (userId && userId !== 'undefined') {
        userSocketMap[userId] = socket.id;
        console.log(`📱 User ${userId} is now online`);

        // Broadcast online status to all connected clients
        io.emit('userOnline', { userId });
    }

    socket.on('disconnect', () => {
        console.log('🔌 User disconnected:', socket.id);

        // Find and remove user from map
        for (const [uid, sid] of Object.entries(userSocketMap)) {
            if (sid === socket.id) {
                delete userSocketMap[uid];
                console.log(`📱 User ${uid} is now offline`);

                // Broadcast offline status
                io.emit('userOffline', { userId: uid });
                break;
            }
        }
    });
});

app.use(express.json({ limit: '10mb' })); // parse JSON with larger limit for images
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
app.use('/api/user/visited-vehicles', visitedVehiclesRoutes); // Recently visited vehicles
app.use('/api/recommended', recommendedRoutes); // Personalized recommendations
app.use('/api/owner', ownerRouter); // Owner dashboard routes
app.use('/api/identity-verification', identityVerificationRouter); // KYC identity verification
app.use('/api/filter', filterRouter); // Search filter routes
app.use('/api/chat', chatRouter); // Chat routes


server.listen(port, () => console.log(`✅ Server running at http://localhost:${port}`));
