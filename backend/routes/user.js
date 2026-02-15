const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Worker = require('../models/Worker');
const Shop = require('../models/Shop');
const ServiceRequest = require('../models/ServiceRequest');
const { protect, authorize } = require('../middleware/auth');

// @route   GET /api/users
// @desc    Get all users (admin only)
// @access  Private/Admin
router.get('/', protect, authorize('admin'), async (req, res, next) => {
    try {
        const { page = 1, limit = 10, role, search } = req.query;
        
        const query = {};
        if (role) query.role = role;
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ];
        }

        const users = await User.find(query)
            .select('-password')
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .sort({ createdAt: -1 });

        const count = await User.countDocuments(query);

        res.json({
            success: true,
            data: {
                users,
                totalPages: Math.ceil(count / limit),
                currentPage: page,
                total: count
            }
        });
    } catch (error) {
        next(error);
    }
});

// @route   GET /api/users/:id
// @desc    Get user by ID
// @access  Private
router.get('/:id', protect, async (req, res, next) => {
    try {
        const user = await User.findById(req.params.id).select('-password');
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Check authorization
        if (req.user._id.toString() !== req.params.id && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to view this user'
            });
        }

        // Get additional data based on role
        let additionalData = {};
        
        if (user.role === 'worker') {
            const worker = await Worker.findOne({ user: user._id });
            additionalData.worker = worker;
        } else if (user.role === 'shop') {
            const shop = await Shop.findOne({ user: user._id });
            additionalData.shop = shop;
        }

        res.json({
            success: true,
            data: {
                user,
                ...additionalData
            }
        });
    } catch (error) {
        next(error);
    }
});

// @route   PUT /api/users/:id
// @desc    Update user
// @access  Private
router.put('/:id', protect, async (req, res, next) => {
    try {
        const { name, phone, avatar } = req.body;

        // Check authorization
        if (req.user._id.toString() !== req.params.id && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to update this user'
            });
        }

        const user = await User.findById(req.params.id);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Admin can update role and isActive
        if (req.user.role === 'admin') {
            if (req.body.role) user.role = req.body.role;
            if (req.body.isActive !== undefined) user.isActive = req.body.isActive;
            if (req.body.isVerified !== undefined) user.isVerified = req.body.isVerified;
        }

        if (name) user.name = name;
        if (phone) user.phone = phone;
        if (avatar) user.avatar = avatar;

        await user.save();

        res.json({
            success: true,
            message: 'User updated successfully',
            data: {
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    phone: user.phone,
                    role: user.role,
                    avatar: user.avatar,
                    isActive: user.isActive,
                    isVerified: user.isVerified
                }
            }
        });
    } catch (error) {
        next(error);
    }
});

// @route   DELETE /api/users/:id
// @desc    Delete user (soft delete - deactivate)
// @access  Private/Admin
router.delete('/:id', protect, authorize('admin'), async (req, res, next) => {
    try {
        const user = await User.findById(req.params.id);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Soft delete
        user.isActive = false;
        await user.save();

        res.json({
            success: true,
            message: 'User deactivated successfully'
        });
    } catch (error) {
        next(error);
    }
});

// @route   GET /api/users/:id/services
// @desc    Get user's service requests
// @access  Private
router.get('/:id/services', protect, async (req, res, next) => {
    try {
        const { page = 1, limit = 10, status } = req.query;

        // Check authorization
        if (req.user._id.toString() !== req.params.id && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to view this user\'s services'
            });
        }

        const query = { customer: req.params.id };
        if (status) query.status = status;

        const services = await ServiceRequest.find(query)
            .populate('worker', 'user profession rating')
            .populate('worker.user', 'name phone avatar')
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .sort({ createdAt: -1 });

        const count = await ServiceRequest.countDocuments(query);

        res.json({
            success: true,
            data: {
                services,
                totalPages: Math.ceil(count / limit),
                currentPage: page,
                total: count
            }
        });
    } catch (error) {
        next(error);
    }
});

// @route   GET /api/users/workers
// @desc    Get all workers
// @access  Public
router.get('/workers/list', async (req, res, next) => {
    try {
        const { page = 1, limit = 10, profession, city, rating } = req.query;
        
        const query = { isVerified: true, isAvailable: true };
        if (profession) query.profession = profession;
        
        const workers = await Worker.find(query)
            .populate('user', 'name phone avatar')
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .sort({ 'rating.average': -1 });

        // Filter by city if provided
        let filteredWorkers = workers;
        if (city) {
            filteredWorkers = workers.filter(w => 
                w.location.city && w.location.city.toLowerCase().includes(city.toLowerCase())
            );
        }

        // Filter by rating if provided
        if (rating) {
            filteredWorkers = filteredWorkers.filter(w => 
                w.rating.average >= parseFloat(rating)
            );
        }

        const count = await Worker.countDocuments(query);

        res.json({
            success: true,
            data: {
                workers: filteredWorkers.map(w => ({
                    id: w._id,
                    name: w.user.name,
                    phone: w.user.phone,
                    avatar: w.user.avatar,
                    profession: w.profession,
                    skills: w.skills,
                    experience: w.experience,
                    hourlyRate: w.hourlyRate,
                    rating: w.rating,
                    location: w.location,
                    completedJobs: w.completedJobs
                })),
                totalPages: Math.ceil(count / limit),
                currentPage: page,
                total: count
            }
        });
    } catch (error) {
        next(error);
    }
});

// @route   GET /api/users/shops
// @desc    Get all shops
// @access  Public
router.get('/shops/list', async (req, res, next) => {
    try {
        const { page = 1, limit = 10, category, city } = req.query;
        
        const query = { isVerified: true, isOpen: true };
        if (category) query.category = category;
        
        const shops = await Shop.find(query)
            .populate('user', 'name phone')
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .sort({ 'rating.average': -1 });

        // Filter by city if provided
        let filteredShops = shops;
        if (city) {
            filteredShops = shops.filter(s => 
                s.address.city && s.address.city.toLowerCase().includes(city.toLowerCase())
            );
        }

        const count = await Shop.countDocuments(query);

        res.json({
            success: true,
            data: {
                shops: filteredShops.map(s => ({
                    id: s._id,
                    shopName: s.shopName,
                    category: s.category,
                    logo: s.logo,
                    coverImage: s.coverImage,
                    address: s.address,
                    phone: s.phone,
                    rating: s.rating
                })),
                totalPages: Math.ceil(count / limit),
                currentPage: page,
                total: count
            }
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
