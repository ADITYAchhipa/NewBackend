import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { createServer } from 'http';
import { Server } from 'socket.io';
import connectDB from './config/db.js';
import 'dotenv/config';
import connectCloudinary from './config/cloudinary.js';
import { generalRateLimiter } from './middleware/rateLimiter.js';
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
import analyticsRouter from './routes/analyticsRoutes.js';
import feedbackRouter from './routes/feedbackRoutes.js';
import couponRouter from './routes/couponRoutes.js';
import uploadRouter from './routes/uploadRoutes.js';
import walletRouter from './routes/walletRoutes.js';
import { blockPrototypePollution } from './middleware/prototypePollutionGuard.js';
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

// Response compression (gzip/deflate) - significant bandwidth savings
app.use(compression({
    level: 6, // Balance compression ratio vs CPU usage
    threshold: 1024, // Only compress responses > 1KB  
}));

// SECURITY: Explicit CORS configuration (no wildcards!)
// Never use origin: true in production - prevents credential theft
const allowedOrigins = [
    'http://localhost:32845',  // Local development
    'http://localhost:5173',  // Vite dev server
    'http://localhost:4173',  // Vite preview
    'http://localhost:51920',  // Vite preview
    'http://localhost:50703',  // Vite preview
    'http://localhost:52081',  // Vite preview
    // Add your production frontend URLs here:
    // 'https://yourfrontend.com',
    // 'https://app.yourdomain.com'
];

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (mobile apps, Postman, etc.)
        if (!origin) return callback(null, true);

        // In development, allow all localhost origins (any port)
        if (origin.startsWith('http://localhost:')) {
            return callback(null, true);
        }

        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            console.log('❌ CORS blocked origin:', origin);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,  // Allow cookies
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token']
}));

// SECURITY: HTTP Parameter Pollution (HPP) Guard
// Prevents attacks like: ?id=valid&id=malicious
// Must be applied BEFORE other middleware parses parameters
import hppGuard from './middleware/hppGuard.js';
app.use(hppGuard);

// Security middleware
// Note: express-mongo-sanitize removed due to Express 5 compatibility issues
// NoSQL injection protection is handled by// ============================================================================
// PHASE 3: REQUEST SHAPE HARDENING
// ============================================================================
// Prototype Pollution Guard - Blocks __proto__, constructor, prototype, $ operators
app.use(blockPrototypePollution);

// Security Headers (Applied first for all requests)
app.use(helmet({
    // Allow cross-origin resources (needed for Cloudinary images)
    crossOriginResourcePolicy: { policy: 'cross-origin' },

    // Content Security Policy - enabled in production
    contentSecurityPolicy: process.env.NODE_ENV === 'production' ? {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https://res.cloudinary.com", "http://localhost:*", "https://localhost:*"],
            connectSrc: ["'self'"],
            fontSrc: ["'self'", "data:"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
        }
    } : false, // Disabled in development for easier debugging

    // Security headers
    hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true
    },

    // Prevent XSS attacks
    xssFilter: true,

    // Prevent clickjacking
    frameguard: { action: 'deny' },

    // Hide X-Powered-By header
    hidePoweredBy: true,

    // Prevent MIME sniffing
    noSniff: true,

    // Referrer policy
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));

// Trust proxy for accurate client IP (important for rate limiting)
app.set('trust proxy', 1);

// Global rate limiter - 100 requests per minute per IP
app.use('/api', generalRateLimiter);

const port = process.env.PORT || 4000;

await connectDB();
await connectCloudinary();


// Middleware
app.use(express.urlencoded({ extended: true })); // for form-data
app.use(cookieParser());

// Serve static files from uploads directory
app.use('/uploads', express.static('uploads'));



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
app.use('/api/analytics', analyticsRouter); // Owner analytics dashboard routes
app.use('/api/feedback', feedbackRouter); // User feedback via email
app.use('/api/coupons', couponRouter); // Coupon claim and apply routes
app.use('/api/upload', uploadRouter); // Image upload routes
app.use('/api/wallet', walletRouter); // Wallet and withdrawal management routes


server.listen(port, () => console.log(`✅ Server running at http://localhost:${port}`));
