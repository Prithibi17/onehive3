const express = require('express');
const router = express.Router();
const ServiceRequest = require('../models/ServiceRequest');
const Worker = require('../models/Worker');
const Tracking = require('../models/Tracking');
const Review = require('../models/Review');
const { protect, authorize, optionalAuth } = require('../middleware/auth');

// @route   POST /api/services
// @desc    Create a service request
// @access  Private
router.post('/', protect, async (req, res, next) => {
    try {
        const { serviceType, title, description, address, location, scheduledDate, scheduledTime, estimatedDuration, estimatedCost, images } = req.body;

        // Create service request
        const serviceRequest = await ServiceRequest.create({
            customer: req.user._id,
            serviceType,
            title,
            description,
            address: address || {},
            location: {
                type: 'Point',
                coordinates: location?.coordinates || [0, 0]
            },
            scheduledDate,
            scheduledTime,
            estimatedDuration: estimatedDuration || 1,
            estimatedCost: estimatedCost || 0,
            images: images || [],
            status: 'pending'
        });

        await serviceRequest.populate('customer', 'name phone avatar');

        res.status(201).json({
            success: true,
            message: 'Service request created successfully',
            data: { serviceRequest }
        });
    } catch (error) {
        next(error);
    }
});

// @route   GET /api/services
// @desc    Get all service requests (for customer)
// @access  Private
router.get('/', protect, async (req, res, next) => {
    try {
        const { status, page = 1, limit = 10 } = req.query;

        const query = { customer: req.user._id };
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

// @route   GET /api/services/:id
// @desc    Get service request by ID
// @access  Private
router.get('/:id', protect, async (req, res, next) => {
    try {
        const serviceRequest = await ServiceRequest.findById(req.params.id)
            .populate('customer', 'name phone avatar')
            .populate('worker', 'user profession rating hourlyRate')
            .populate('worker.user', 'name phone avatar');

        if (!serviceRequest) {
            return res.status(404).json({
                success: false,
                message: 'Service request not found'
            });
        }

        // Check authorization
        const isOwner = serviceRequest.customer._id.toString() === req.user._id.toString();
        const isWorker = serviceRequest.worker && serviceRequest.worker.user._id.toString() === req.user._id.toString();
        
        if (!isOwner && !isWorker && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to view this service request'
            });
        }

        res.json({
            success: true,
            data: { serviceRequest }
        });
    } catch (error) {
        next(error);
    }
});

// @route   PUT /api/services/:id/accept
// @desc    Accept a service request (worker only)
// @access  Private/Worker
router.put('/:id/accept', protect, authorize('worker'), async (req, res, next) => {
    try {
        const serviceRequest = await ServiceRequest.findById(req.params.id);

        if (!serviceRequest) {
            return res.status(404).json({
                success: false,
                message: 'Service request not found'
            });
        }

        if (serviceRequest.status !== 'pending') {
            return res.status(400).json({
                success: false,
                message: 'This service request is no longer available'
            });
        }

        const worker = await Worker.findOne({ user: req.user._id });
        if (!worker) {
            return res.status(404).json({
                success: false,
                message: 'Worker profile not found'
            });
        }

        // Update service request
        serviceRequest.worker = worker._id;
        serviceRequest.status = 'accepted';
        serviceRequest.acceptedAt = new Date();
        await serviceRequest.save();

        // Update worker stats
        worker.completedJobs += 1;
        await worker.save();

        await serviceRequest.populate('worker', 'user profession');
        await serviceRequest.populate('worker.user', 'name phone avatar');

        res.json({
            success: true,
            message: 'Service request accepted',
            data: { serviceRequest }
        });
    } catch (error) {
        next(error);
    }
});

// @route   PUT /api/services/:id/reject
// @desc    Reject a service request
// @access  Private
router.put('/:id/reject', protect, async (req, res, next) => {
    try {
        const { cancellationReason } = req.body;
        
        const serviceRequest = await ServiceRequest.findById(req.params.id);

        if (!serviceRequest) {
            return res.status(404).json({
                success: false,
                message: 'Service request not found'
            });
        }

        // Check authorization
        const isWorker = serviceRequest.worker && serviceRequest.worker.toString() === req.user._id.toString();
        const isCustomer = serviceRequest.customer.toString() === req.user._id.toString();
        
        if (!isWorker && !isCustomer && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to reject this service request'
            });
        }

        if (isWorker) {
            serviceRequest.status = 'rejected';
            serviceRequest.cancellationReason = cancellationReason || 'Rejected by worker';
        } else if (isCustomer) {
            serviceRequest.status = 'cancelled';
            serviceRequest.cancellationReason = cancellationReason || 'Cancelled by customer';
        }
        
        serviceRequest.cancelledAt = new Date();
        await serviceRequest.save();

        res.json({
            success: true,
            message: isWorker ? 'Service request rejected' : 'Service request cancelled',
            data: { serviceRequest }
        });
    } catch (error) {
        next(error);
    }
});

// @route   PUT /api/services/:id/start
// @desc    Start service (worker only)
// @access  Private/Worker
router.put('/:id/start', protect, authorize('worker'), async (req, res, next) => {
    try {
        const serviceRequest = await ServiceRequest.findById(req.params.id);

        if (!serviceRequest) {
            return res.status(404).json({
                success: false,
                message: 'Service request not found'
            });
        }

        // Verify worker
        const worker = await Worker.findOne({ user: req.user._id });
        if (!worker || serviceRequest.worker.toString() !== worker._id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to start this service'
            });
        }

        if (serviceRequest.status !== 'accepted') {
            return res.status(400).json({
                success: false,
                message: 'Service must be accepted before starting'
            });
        }

        serviceRequest.status = 'in_progress';
        serviceRequest.startedAt = new Date();
        await serviceRequest.save();

        // Create tracking record
        const tracking = await Tracking.create({
            serviceRequest: serviceRequest._id,
            worker: worker._id,
            customer: serviceRequest.customer,
            currentLocation: worker.location,
            destination: {
                type: 'Point',
                coordinates: serviceRequest.location.coordinates
            },
            status: 'en_route'
        });

        res.json({
            success: true,
            message: 'Service started',
            data: { serviceRequest, tracking }
        });
    } catch (error) {
        next(error);
    }
});

// @route   PUT /api/services/:id/complete
// @desc    Complete service (worker only)
// @access  Private/Worker
router.put('/:id/complete', protect, authorize('worker'), async (req, res, next) => {
    try {
        const { actualCost } = req.body;
        
        const serviceRequest = await ServiceRequest.findById(req.params.id);

        if (!serviceRequest) {
            return res.status(404).json({
                success: false,
                message: 'Service request not found'
            });
        }

        // Verify worker
        const worker = await Worker.findOne({ user: req.user._id });
        if (!worker || serviceRequest.worker.toString() !== worker._id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to complete this service'
            });
        }

        if (serviceRequest.status !== 'in_progress') {
            return res.status(400).json({
                success: false,
                message: 'Service must be in progress to complete'
            });
        }

        serviceRequest.status = 'completed';
        serviceRequest.completedAt = new Date();
        if (actualCost) serviceRequest.estimatedCost = actualCost;
        await serviceRequest.save();

        // End tracking
        await Tracking.findOneAndUpdate(
            { serviceRequest: serviceRequest._id },
            { 
                isLive: false, 
                status: 'completed',
                endedAt: new Date()
            }
        );

        res.json({
            success: true,
            message: 'Service completed successfully',
            data: { serviceRequest }
        });
    } catch (error) {
        next(error);
    }
});

// @route   PUT /api/services/:id/rate
// @desc    Rate service
// @access  Private
router.put('/:id/rate', protect, async (req, res, next) => {
    try {
        const { rating, review, reviewType } = req.body;
        
        const serviceRequest = await ServiceRequest.findById(req.params.id);

        if (!serviceRequest) {
            return res.status(404).json({
                success: false,
                message: 'Service request not found'
            });
        }

        if (serviceRequest.status !== 'completed') {
            return res.status(400).json({
                success: false,
                message: 'Can only rate completed services'
            });
        }

        // Check if already rated
        if (serviceRequest.customerRating) {
            return res.status(400).json({
                success: false,
                message: 'Service already rated'
            });
        }

        const isCustomer = serviceRequest.customer.toString() === req.user._id.toString();
        
        if (isCustomer && reviewType === 'customer_to_worker') {
            serviceRequest.customerRating = rating;
            serviceRequest.customerReview = review || '';
            
            // Create review
            const worker = await Worker.findById(serviceRequest.worker);
            await Review.create({
                serviceRequest: serviceRequest._id,
                reviewer: req.user._id,
                reviewee: worker.user,
                worker: worker._id,
                rating,
                review: review || '',
                reviewType: 'customer_to_worker'
            });
            
            // Update worker rating
            await Review.updateRating(worker._id, 'worker');
        }

        await serviceRequest.save();

        res.json({
            success: true,
            message: 'Rating submitted successfully',
            data: { serviceRequest }
        });
    } catch (error) {
        next(error);
    }
});

// @route   GET /api/services/nearby
// @desc    Get nearby pending service requests
// @access  Private/Worker
router.get('/nearby/requests', protect, authorize('worker'), async (req, res, next) => {
    try {
        const { latitude, longitude, radius = 10 } = req.query;

        if (!latitude || !longitude) {
            return res.status(400).json({
                success: false,
                message: 'Latitude and longitude are required'
            });
        }

        const worker = await Worker.findOne({ user: req.user._id });
        if (!worker) {
            return res.status(404).json({
                success: false,
                message: 'Worker profile not found'
            });
        }

        const requests = await ServiceRequest.find({
            serviceType: worker.profession,
            status: 'pending',
            location: {
                $near: {
                    $geometry: {
                        type: 'Point',
                        coordinates: [parseFloat(longitude), parseFloat(latitude)]
                    },
                    $maxDistance: parseFloat(radius) * 1000
                }
            }
        })
        .populate('customer', 'name phone avatar')
        .sort({ createdAt: -1 });

        res.json({
            success: true,
            data: { requests }
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
