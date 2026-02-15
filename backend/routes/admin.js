const express = require('express');
const router = express.Router();
const User = require('../models/User');

// Get admin statistics
router.get('/stats', async (req, res) => {
    try {
        console.log("[ADMIN] Stats API hit - querying MongoDB");
        
        const totalUsers = await User.countDocuments();
        const totalWorkers = await User.countDocuments({ role: 'worker' });
        const totalCustomers = await User.countDocuments({ role: 'customer' });
        
        console.log("[ADMIN] Stats result:", { totalUsers, totalWorkers, totalCustomers });
        
        res.json({
            success: true,
            data: {
                totalUsers,
                totalWorkers,
                totalCustomers
            }
        });
    } catch (error) {
        console.error('[ADMIN] Stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching statistics',
            error: error.message
        });
    }
});

// Get all registered users
router.get('/users', async (req, res) => {
    try {
        console.log("[ADMIN] Users API hit - fetching all users");
        
        const users = await User.find({})
            .select('name role createdAt')
            .sort({ createdAt: -1 });
        
        console.log("[ADMIN] Users result:", users.length, "users found");
        
        res.json({
            success: true,
            data: users.map(user => ({
                name: user.name,
                role: user.role,
                createdAt: user.createdAt
            }))
        });
    } catch (error) {
        console.error('[ADMIN] Users error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching users',
            error: error.message
        });
    }
});

module.exports = router;
