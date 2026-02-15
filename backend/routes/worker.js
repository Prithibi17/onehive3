const express = require('express');
const router = express.Router();
const Worker = require('../models/Worker');
const User = require('../models/User');
const ServiceRequest = require('../models/ServiceRequest');
const { protect, authorize, optionalAuth } = require('../middleware/auth');
const { calculateDistance } = require('../utils/helpers');

// @route   GET /api/workers
// @desc    Get all workers (for admin)
// @access  Public
router.get('/', async (req, res) => {
    try {
        console.log("[WORKERS] GET /api/workers called");
        const workers = await Worker.find().populate('user', 'name email phone');
        res.json({
            success: true,
            data: workers
        });
    } catch (error) {
        console.error("[WORKERS] Error:", error);
        res.status(500).json({
            success: false,
            message: 'Error fetching workers',
            error: error.message
        });
    }
});

// @route   POST /api/workers/register
// @desc    Register as a worker
// @access  Private
router.post('/register', protect, async (req, res, next) => {
    try {
        const { profession, skills, experience, description, hourlyRate, location, serviceArea, availability, gender, dob, whatsapp } = req.body;

        // Check if already a worker
        const existingWorker = await Worker.findOne({ user: req.user._id });
        if (existingWorker) {
            return res.status(400).json({
                success: false,
                message: 'You are already registered as a worker'
            });
        }

        // Update user with gender, dob, whatsapp if provided
        if (gender || dob || whatsapp) {
            const updateFields = {};
            if (gender) updateFields.gender = gender;
            if (dob) updateFields.dob = dob;
            if (whatsapp) updateFields.whatsapp = whatsapp;
            await User.findByIdAndUpdate(req.user._id, updateFields);
        }

        // Generate unique tracking ID
        const year = new Date().getFullYear();
        const countResult = await Worker.countDocuments();
        const trackingNumber = String(countResult + 1).padStart(4, '0');
        const trackingId = `OH-PART-${year}-${trackingNumber}`;

        // Create worker profile
        const worker = await Worker.create({
            user: req.user._id,
            profession,
            skills: skills || [],
            experience: experience || 0,
            description: description || '',
            hourlyRate: hourlyRate || 0,
            location: {
                type: 'Point',
                coordinates: location?.coordinates || [0, 0],
                address: location?.address || '',
                city: location?.city || '',
                state: location?.state || '',
                pincode: location?.pincode || ''
            },
            serviceArea: serviceArea || 10,
            availability: availability || {
                monday: { start: '09:00', end: '18:00', available: true },
                tuesday: { start: '09:00', end: '18:00', available: true },
                wednesday: { start: '09:00', end: '18:00', available: true },
                thursday: { start: '09:00', end: '18:00', available: true },
                friday: { start: '09:00', end: '18:00', available: true },
                saturday: { start: '09:00', end: '18:00', available: true },
                sunday: { start: '09:00', end: '18:00', available: false }
            },
            trackingId: trackingId,
            applicationStatus: 'pending'
        });

        // Update user role to worker
        await User.findByIdAndUpdate(req.user._id, { role: 'worker' });

        res.status(201).json({
            success: true,
            message: 'Worker registration successful',
            data: {
                worker,
                trackingId: trackingId
            }
        });
    } catch (error) {
        next(error);
    }
});

// @route   GET /api/workers/profile
// @desc    Get current worker profile
// @access  Private/Worker
router.get('/profile', protect, authorize('worker', 'admin'), async (req, res, next) => {
    try {
        const worker = await Worker.findOne({ user: req.user._id })
            .populate('user', 'name email phone avatar');

        if (!worker) {
            return res.status(404).json({
                success: false,
                message: 'Worker profile not found'
            });
        }

        res.json({
            success: true,
            data: { worker }
        });
    } catch (error) {
        next(error);
    }
});

// @route   PUT /api/workers/profile
// @desc    Update worker profile
// @access  Private/Worker
router.put('/profile', protect, authorize('worker', 'admin'), async (req, res, next) => {
    try {
        const { skills, experience, description, hourlyRate, location, serviceArea, availability, isAvailable, profileImage } = req.body;

        const worker = await Worker.findOne({ user: req.user._id });

        if (!worker) {
            return res.status(404).json({
                success: false,
                message: 'Worker profile not found'
            });
        }

        if (skills) worker.skills = skills;
        if (experience !== undefined) worker.experience = experience;
        if (description !== undefined) worker.description = description;
        if (hourlyRate !== undefined) worker.hourlyRate = hourlyRate;
        if (profileImage) worker.profileImage = profileImage;
        if (isAvailable !== undefined) worker.isAvailable = isAvailable;
        
        if (location) {
            worker.location = {
                type: 'Point',
                coordinates: location.coordinates || worker.location.coordinates,
                address: location.address || worker.location.address,
                city: location.city || worker.location.city,
                state: location.state || worker.location.state,
                pincode: location.pincode || worker.location.pincode
            };
        }
        
        if (serviceArea) worker.serviceArea = serviceArea;
        if (availability) worker.availability = availability;

        await worker.save();

        res.json({
            success: true,
            message: 'Profile updated successfully',
            data: { worker }
        });
    } catch (error) {
        next(error);
    }
});

// @route   PUT /api/workers/location
// @desc    Update worker location
// @access  Private/Worker
router.put('/location', protect, authorize('worker'), async (req, res, next) => {
    try {
        const { coordinates, address, city, state, pincode } = req.body;

        const worker = await Worker.findOne({ user: req.user._id });

        if (!worker) {
            return res.status(404).json({
                success: false,
                message: 'Worker profile not found'
            });
        }

        worker.location.coordinates = coordinates || worker.location.coordinates;
        if (address) worker.location.address = address;
        if (city) worker.location.city = city;
        if (state) worker.location.state = state;
        if (pincode) worker.location.pincode = pincode;

        await worker.save();

        res.json({
            success: true,
            message: 'Location updated successfully',
            data: {
                location: worker.location
            }
        });
    } catch (error) {
        next(error);
    }
});

// @route   GET /api/workers/:id
// @desc    Get worker by ID
// @access  Public
router.get('/:id', optionalAuth, async (req, res, next) => {
    try {
        const worker = await Worker.findById(req.params.id)
            .populate('user', 'name phone avatar');

        if (!worker) {
            return res.status(404).json({
                success: false,
                message: 'Worker not found'
            });
        }

        res.json({
            success: true,
            data: { worker }
        });
    } catch (error) {
        next(error);
    }
});

// @route   GET /api/workers/nearby
// @desc    Find nearby workers
// @access  Public
router.get('/nearby', optionalAuth, async (req, res, next) => {
    try {
        const { latitude, longitude, profession, radius = 10 } = req.query;

        if (!latitude || !longitude) {
            return res.status(400).json({
                success: false,
                message: 'Latitude and longitude are required'
            });
        }

        const query = {
            isVerified: true,
            isAvailable: true,
            location: {
                $near: {
                    $geometry: {
                        type: 'Point',
                        coordinates: [parseFloat(longitude), parseFloat(latitude)]
                    },
                    $maxDistance: parseFloat(radius) * 1000 // Convert km to meters
                }
            }
        };

        if (profession) query.profession = profession;

        const workers = await Worker.find(query)
            .populate('user', 'name phone avatar');

        res.json({
            success: true,
            data: {
                workers: workers.map(w => ({
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
                    distance: calculateDistance(
                        parseFloat(latitude),
                        parseFloat(longitude),
                        w.location.coordinates[1],
                        w.location.coordinates[0]
                    ).toFixed(2)
                }))
            }
        });
    } catch (error) {
        next(error);
    }
});

// @route   GET /api/workers/search
// @desc    Search workers
// @access  Public
router.get('/search', optionalAuth, async (req, res, next) => {
    try {
        const { profession, city, minRating, maxHourlyRate, page = 1, limit = 10 } = req.query;

        const query = { isVerified: true };
        
        if (profession) query.profession = profession;
        if (city) query['location.city'] = { $regex: city, $options: 'i' };
        if (minRating) query['rating.average'] = { $gte: parseFloat(minRating) };
        if (maxHourlyRate) query.hourlyRate = { $lte: parseFloat(maxHourlyRate) };

        const workers = await Worker.find(query)
            .populate('user', 'name phone avatar')
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .sort({ 'rating.average': -1, completedJobs: -1 });

        const count = await Worker.countDocuments(query);

        res.json({
            success: true,
            data: {
                workers: workers.map(w => ({
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

// @route   GET /api/workers/requests
// @desc    Get worker's service requests
// @access  Private/Worker
router.get('/my/requests', protect, authorize('worker'), async (req, res, next) => {
    try {
        const { status, page = 1, limit = 10 } = req.query;

        const worker = await Worker.findOne({ user: req.user._id });
        if (!worker) {
            return res.status(404).json({
                success: false,
                message: 'Worker profile not found'
            });
        }

        const query = { worker: worker._id };
        if (status) query.status = status;

        const requests = await ServiceRequest.find(query)
            .populate('customer', 'name phone avatar')
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .sort({ createdAt: -1 });

        const count = await ServiceRequest.countDocuments(query);

        res.json({
            success: true,
            data: {
                requests,
                totalPages: Math.ceil(count / limit),
                currentPage: page,
                total: count
            }
        });
    } catch (error) {
        next(error);
    }
});

// @route   GET /api/workers/available-requests
// @desc    Get available service requests for worker
// @access  Private/Worker
router.get('/available/requests', protect, authorize('worker'), async (req, res, next) => {
    try {
        const worker = await Worker.findOne({ user: req.user._id });
        if (!worker) {
            return res.status(404).json({
                success: false,
                message: 'Worker profile not found'
            });
        }

        // Get requests matching worker's profession and within service area
        const requests = await ServiceRequest.find({
            serviceType: worker.profession,
            status: 'pending'
        })
        .populate('customer', 'name phone avatar')
        .sort({ createdAt: -1 });

        // Filter by distance
        const availableRequests = requests.filter(req => {
            if (req.location.coordinates[0] === 0 && req.location.coordinates[1] === 0) {
                return true;
            }
            const distance = calculateDistance(
                worker.location.coordinates[1],
                worker.location.coordinates[0],
                req.location.coordinates[1],
                req.location.coordinates[0]
            );
            return distance <= worker.serviceArea;
        });

        res.json({
            success: true,
            data: { requests: availableRequests }
        });
    } catch (error) {
        next(error);
    }
});

// @route   PUT /api/workers/verify/:id
// @desc    Verify worker (admin only)
// @access  Private/Admin
router.put('/verify/:id', protect, authorize('admin'), async (req, res, next) => {
    try {
        const { isVerified, verificationStatus } = req.body;

        const worker = await Worker.findById(req.params.id);

        if (!worker) {
            return res.status(404).json({
                success: false,
                message: 'Worker not found'
            });
        }

        if (isVerified !== undefined) worker.isVerified = isVerified;
        if (verificationStatus) worker.verificationStatus = verificationStatus;

        await worker.save();

        res.json({
            success: true,
            message: 'Worker verification updated',
            data: { worker }
        });
    } catch (error) {
        next(error);
    }
});

// @route   PUT /api/workers/status/:id
// @desc    Update worker application status (admin)
// @access  Private
router.put('/status/:id', protect, async (req, res, next) => {
    try {
        const { applicationStatus } = req.body;

        const worker = await Worker.findById(req.params.id);

        if (!worker) {
            return res.status(404).json({
                success: false,
                message: 'Worker not found'
            });
        }

        if (applicationStatus) worker.applicationStatus = applicationStatus;

        await worker.save();

        res.json({
            success: true,
            message: 'Worker status updated',
            data: { worker }
        });
    } catch (error) {
        next(error);
    }
});

// @route   GET /api/workers/track/:trackingId
// @desc    Track worker application by tracking ID
// @access  Public
router.get('/track/:trackingId', async (req, res, next) => {
    try {
        const { trackingId } = req.params;

        const worker = await Worker.findOne({ trackingId }).populate('user', 'name email phone');

        if (!worker) {
            return res.status(404).json({
                success: false,
                message: 'Invalid Tracking ID'
            });
        }

        res.json({
            success: true,
            data: {
                trackingId: worker.trackingId,
                name: worker.user.name,
                email: worker.user.email,
                phone: worker.user.phone,
                profession: worker.profession,
                applicationStatus: worker.applicationStatus,
                verificationStatus: worker.verificationStatus,
                createdAt: worker.createdAt
            }
        });
    } catch (error) {
        next(error);
    }
});

// @route   DELETE /api/workers/:id
// @desc    Delete worker
// @access  Private
router.delete('/:id', protect, async (req, res, next) => {
    try {
        const worker = await Worker.findById(req.params.id);
        
        if (!worker) {
            return res.status(404).json({
                success: false,
                message: 'Worker not found'
            });
        }

        // Delete the worker
        await Worker.findByIdAndDelete(req.params.id);

        res.json({
            success: true,
            message: 'Worker deleted successfully'
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
