require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');
const { MongoMemoryServer } = require('mongodb-memory-server');

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const workerRoutes = require('./routes/worker');
const shopRoutes = require('./routes/shop');
const serviceRoutes = require('./routes/service');
const trackingRoutes = require('./routes/tracking');
const reviewRoutes = require('./routes/review');
const heroRoutes = require('./routes/hero');
const adminRoutes = require('./routes/admin');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Database connection - use in-memory MongoDB for development
async function connectDB() {
    try {
        // Start in-memory MongoDB
        const mongoServer = await MongoMemoryServer.create();
        const mongoUri = mongoServer.getUri();
        
        await mongoose.connect(mongoUri);
        console.log('MongoDB Memory Server connected successfully');
        console.log(`In-memory MongoDB URI: ${mongoUri}`);
    } catch (err) {
        console.error('MongoDB connection error:', err);
        // Fallback to local MongoDB
        try {
            await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/onehive');
            console.log('Local MongoDB connected successfully');
        } catch (localErr) {
            console.error('Local MongoDB also failed:', localErr);
        }
    }
}

connectDB();

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/workers', workerRoutes);
app.use('/api/shops', shopRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/tracking', trackingRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/hero', heroRoutes);
app.use('/api/admin', adminRoutes);

// Health check route
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'OneHive API is running' });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ 
        success: false, 
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ success: false, message: 'Route not found' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`OneHive server running on port ${PORT}`);
});

module.exports = app;
