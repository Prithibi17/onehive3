const express = require('express');
const router = express.Router();
const Tracking = require('../models/Tracking');
const Worker = require('../models/Worker');
const ServiceRequest = require('../models/ServiceRequest');
const { protect, authorize, optionalAuth } = require('../middleware/auth');

// @route   POST /api/tracking
// @desc    Create tracking session
// @access  Private/Worker
router.post('/', protect, authorize('worker'), async (req, res, next) => {
    try {
        const { serviceRequestId, coordinates, address } = req.body;

        const serviceRequest = await ServiceRequest.findById(serviceRequestId);
        if (!serviceRequest) {
            return res.status(404).json({
                success: false,
                message: 'Service request not found'
            });
        }

        const worker = await Worker.findOne({ user: req.user._id });
        if (!worker) {
            return res.status(404).json({
                success: false,
                message: 'Worker profile not found'
            });
        }

        // Check if tracking already exists
        const existingTracking = await Tracking.findOne({
            serviceRequest: serviceRequestId,
            isLive: true
        });

        if (existingTracking) {
            return res.status(400).json({
                success: false,
                message: 'Tracking already active for this service'
            });
        }

        const tracking = await Tracking.create({
            serviceRequest: serviceRequestId,
            worker: worker._id,
            customer: serviceRequest.customer,
            currentLocation: {
                type: 'Point',
                coordinates: coordinates || [0, 0],
                address: address || ''
            },
            destination: {
                type: 'Point',
                coordinates: serviceRequest.location.coordinates
            },
            status: 'en_route',
            isLive: true,
            locationHistory: [{
                coordinates: coordinates || [0, 0],
                address: address || '',
                timestamp: new Date()
            }]
        });

        await tracking.populate('worker', 'user');
        await tracking.populate('worker.user', 'name phone avatar');

        res.status(201).json({
            success: true,
            message: 'Tracking started',
            data: { tracking }
        });
    } catch (error) {
        next(error);
    }
});

// @route   PUT /api/tracking/:id/location
// @desc    Update worker location
// @access  Private/Worker
router.put('/:id/location', protect, authorize('worker'), async (req, res, next) => {
    try {
        const { coordinates, address } = req.body;

        const tracking = await Tracking.findById(req.params.id);

        if (!tracking) {
            return res.status(404).json({
                success: false,
                message: 'Tracking not found'
            });
        }

        // Verify worker
        const worker = await Worker.findOne({ user: req.user._id });
        if (!worker || tracking.worker.toString() !== worker._id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to update this tracking'
            });
        }

        // Update current location
        tracking.currentLocation = {
            type: 'Point',
            coordinates: coordinates || tracking.currentLocation.coordinates,
            address: address || tracking.currentLocation.address,
            timestamp: new Date()
        };

        // Add to history
        tracking.locationHistory.push({
            coordinates: coordinates || tracking.currentLocation.coordinates,
            address: address || tracking.currentLocation.address,
            timestamp: new Date()
        });

        // Update worker location in worker profile
        worker.location.coordinates = coordinates || worker.location.coordinates;
        if (address) worker.location.address = address;
        await worker.save();

        await tracking.save();

        res.json({
            success: true,
            message: 'Location updated',
            data: {
                currentLocation: tracking.currentLocation,
                status: tracking.status
            }
        });
    } catch (error) {
        next(error);
    }
});

// @route   PUT /api/tracking/:id/status
// @desc    Update tracking status
// @access  Private/Worker
router.put('/:id/status', protect, authorize('worker'), async (req, res, next) => {
    try {
        const { status } = req.body;

        const tracking = await Tracking.findById(req.params.id);

        if (!tracking) {
            return res.status(404).json({
                success: false,
                message: 'Tracking not found'
            });
        }

        // Verify worker
        const worker = await Worker.findOne({ user: req.user._id });
        if (!worker || tracking.worker.toString() !== worker._id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to update this tracking'
            });
        }

        if (!['en_route', 'arrived', 'working', 'completed'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status'
            });
        }

        tracking.status = status;
        
        if (status === 'completed') {
            tracking.isLive = false;
            tracking.endedAt = new Date();
        }

        await tracking.save();

        // Update service request status
        if (status === 'arrived') {
            await ServiceRequest.findByIdAndUpdate(tracking.serviceRequest, {
                status: 'in_progress'
            });
        }

        res.json({
            success: true,
            message: 'Status updated',
            data: { tracking }
        });
    } catch (error) {
        next(error);
    }
});

// @route   GET /api/tracking/service/:serviceRequestId
// @desc    Get tracking for a service request
// @access  Private
router.get('/service/:serviceRequestId', protect, async (req, res, next) => {
    try {
        const serviceRequest = await ServiceRequest.findById(req.params.serviceRequestId);

        if (!serviceRequest) {
            return res.status(404).json({
                success: false,
                message: 'Service request not found'
            });
        }

        // Check authorization
        const isCustomer = serviceRequest.customer.toString() === req.user._id.toString();
        const worker = await Worker.findOne({ user: req.user._id });
        const isWorker = worker && serviceRequest.worker && serviceRequest.worker.toString() === worker._id.toString();
        
        if (!isCustomer && !isWorker && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to view this tracking'
            });
        }

        const tracking = await Tracking.findOne({ serviceRequest: req.params.serviceRequestId })
            .populate('worker', 'user profession')
            .populate('worker.user', 'name phone avatar')
            .populate('customer', 'name phone');

        if (!tracking) {
            return res.status(404).json({
                success: false,
                message: 'Tracking not found'
            });
        }

        res.json({
            success: true,
            data: { tracking }
        });
    } catch (error) {
        next(error);
    }
});

// @route   GET /api/tracking/live
// @desc    Get all live tracking sessions
// @access  Private/Admin
router.get('/live', protect, authorize('admin'), async (req, res, next) => {
    try {
        const tracking = await Tracking.find({ isLive: true })
            .populate('worker', 'user profession')
            .populate('worker.user', 'name phone avatar')
            .populate('customer', 'name phone')
            .populate('serviceRequest', 'title serviceType status');

        res.json({
            success: true,
            data: { tracking }
        });
    } catch (error) {
        next(error);
    }
});

// @route   GET /api/tracking/history
// @desc    Get tracking history for worker
// @access  Private/Worker
router.get('/history', protect, authorize('worker'), async (req, res, next) => {
    try {
        const { page = 1, limit = 10 } = req.query;

        const worker = await Worker.findOne({ user: req.user._id });
        if (!worker) {
            return res.status(404).json({
                success: false,
                message: 'Worker profile not found'
            });
        }

        const tracking = await Tracking.find({ worker: worker._id })
            .populate('customer', 'name phone')
            .populate('serviceRequest', 'title serviceType status completedAt')
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .sort({ startedAt: -1 });

        const count = await Tracking.countDocuments({ worker: worker._id });

        res.json({
            success: true,
            data: {
                tracking,
                totalPages: Math.ceil(count / limit),
                currentPage: page,
                total: count
            }
        });
    } catch (error) {
        next(error);
    }
});

// @route   PUT /api/tracking/:id/end
// @desc    End tracking session
// @access  Private/Worker
router.put('/:id/end', protect, authorize('worker'), async (req, res, next) => {
    try {
        const tracking = await Tracking.findById(req.params.id);

        if (!tracking) {
            return res.status(404).json({
                success: false,
                message: 'Tracking not found'
            });
        }

        // Verify worker
        const worker = await Worker.findOne({ user: req.user._id });
        if (!worker || tracking.worker.toString() !== worker._id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to end this tracking'
            });
        }

        tracking.isLive = false;
        tracking.status = 'completed';
        tracking.endedAt = new Date();
        await tracking.save();

        res.json({
            success: true,
            message: 'Tracking ended',
            data: { tracking }
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
