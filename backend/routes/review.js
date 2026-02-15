const express = require('express');
const router = express.Router();
const Review = require('../models/Review');
const Worker = require('../models/Worker');
const Shop = require('../models/Shop');
const ServiceRequest = require('../models/ServiceRequest');
const { protect, authorize, optionalAuth } = require('../middleware/auth');

// @route   POST /api/reviews
// @desc    Create a review
// @access  Private
router.post('/', protect, async (req, res, next) => {
    try {
        const { serviceRequestId, rating, review, reviewType } = req.body;

        const serviceRequest = await ServiceRequest.findById(serviceRequestId);
        if (!serviceRequest) {
            return res.status(404).json({
                success: false,
                message: 'Service request not found'
            });
        }

        if (serviceRequest.status !== 'completed') {
            return res.status(400).json({
                success: false,
                message: 'Can only review completed services'
            });
        }

        // Determine reviewee based on review type
        let reviewee, targetModel, targetId;

        if (reviewType === 'customer_to_worker') {
            if (!serviceRequest.worker) {
                return res.status(400).json({
                    success: false,
                    message: 'No worker assigned to this service'
                });
            }
            const worker = await Worker.findById(serviceRequest.worker);
            reviewee = worker.user;
            targetModel = 'worker';
            targetId = worker._id;
        } else if (reviewType === 'customer_to_shop') {
            // Handle shop reviews if needed
            return res.status(400).json({
                success: false,
                message: 'Shop reviews not implemented'
            });
        } else {
            return res.status(400).json({
                success: false,
                message: 'Invalid review type'
            });
        }

        // Check if already reviewed
        const existingReview = await Review.findOne({
            serviceRequest: serviceRequestId,
            reviewer: req.user._id
        });

        if (existingReview) {
            return res.status(400).json({
                success: false,
                message: 'You have already reviewed this service'
            });
        }

        // Create review
        const newReview = await Review.create({
            serviceRequest: serviceRequestId,
            reviewer: req.user._id,
            reviewee,
            worker: reviewType === 'customer_to_worker' ? targetId : undefined,
            rating,
            review: review || '',
            reviewType
        });

        // Update target rating
        await Review.updateRating(targetId, targetModel);

        // Update service request with rating
        if (reviewType === 'customer_to_worker') {
            serviceRequest.customerRating = rating;
            serviceRequest.customerReview = review || '';
            await serviceRequest.save();
        }

        await newReview.populate('reviewer', 'name avatar');
        await newReview.populate('reviewee', 'name');

        res.status(201).json({
            success: true,
            message: 'Review submitted successfully',
            data: { review: newReview }
        });
    } catch (error) {
        next(error);
    }
});

// @route   GET /api/reviews/worker/:workerId
// @desc    Get reviews for a worker
// @access  Public
router.get('/worker/:workerId', optionalAuth, async (req, res, next) => {
    try {
        const { page = 1, limit = 10 } = req.query;

        const reviews = await Review.find({ 
            worker: req.params.workerId,
            reviewType: 'customer_to_worker',
            isActive: true
        })
        .populate('reviewer', 'name avatar')
        .populate('serviceRequest', 'title createdAt')
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .sort({ createdAt: -1 });

        const count = await Review.countDocuments({ 
            worker: req.params.workerId,
            reviewType: 'customer_to_worker',
            isActive: true
        });

        // Calculate average
        const worker = await Worker.findById(req.params.workerId);
        const averageRating = worker ? worker.rating.average : 0;

        res.json({
            success: true,
            data: {
                reviews,
                averageRating,
                totalPages: Math.ceil(count / limit),
                currentPage: page,
                total: count
            }
        });
    } catch (error) {
        next(error);
    }
});

// @route   GET /api/reviews/shop/:shopId
// @desc    Get reviews for a shop
// @access  Public
router.get('/shop/:shopId', optionalAuth, async (req, res, next) => {
    try {
        const { page = 1, limit = 10 } = req.query;

        const reviews = await Review.find({ 
            shop: req.params.shopId,
            reviewType: 'customer_to_shop',
            isActive: true
        })
        .populate('reviewer', 'name avatar')
        .populate('serviceRequest', 'title createdAt')
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .sort({ createdAt: -1 });

        const count = await Review.countDocuments({ 
            shop: req.params.shopId,
            reviewType: 'customer_to_shop',
            isActive: true
        });

        // Calculate average
        const shop = await Shop.findById(req.params.shopId);
        const averageRating = shop ? shop.rating.average : 0;

        res.json({
            success: true,
            data: {
                reviews,
                averageRating,
                totalPages: Math.ceil(count / limit),
                currentPage: page,
                total: count
            }
        });
    } catch (error) {
        next(error);
    }
});

// @route   GET /api/reviews/user/:userId
// @desc    Get reviews given by or received by a user
// @access  Private
router.get('/user/:userId', protect, async (req, res, next) => {
    try {
        const { type = 'given', page = 1, limit = 10 } = req.query;

        // Check authorization
        if (req.user._id.toString() !== req.params.userId && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to view these reviews'
            });
        }

        const query = type === 'given' 
            ? { reviewer: req.params.userId }
            : { reviewee: req.params.userId };

        const reviews = await Review.find({ ...query, isActive: true })
            .populate('reviewer', 'name avatar')
            .populate('reviewee', 'name')
            .populate('worker', 'profession')
            .populate('serviceRequest', 'title')
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .sort({ createdAt: -1 });

        const count = await Review.countDocuments({ ...query, isActive: true });

        res.json({
            success: true,
            data: {
                reviews,
                totalPages: Math.ceil(count / limit),
                currentPage: page,
                total: count
            }
        });
    } catch (error) {
        next(error);
    }
});

// @route   PUT /api/reviews/:id
// @desc    Update a review
// @access  Private
router.put('/:id', protect, async (req, res, next) => {
    try {
        const { rating, review } = req.body;

        const existingReview = await Review.findById(req.params.id);

        if (!existingReview) {
            return res.status(404).json({
                success: false,
                message: 'Review not found'
            });
        }

        // Check authorization
        if (existingReview.reviewer.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to update this review'
            });
        }

        if (rating) existingReview.rating = rating;
        if (review !== undefined) existingReview.review = review;

        await existingReview.save();

        // Update target rating
        if (existingReview.worker) {
            await Review.updateRating(existingReview.worker, 'worker');
        } else if (existingReview.shop) {
            await Review.updateRating(existingReview.shop, 'shop');
        }

        res.json({
            success: true,
            message: 'Review updated successfully',
            data: { review: existingReview }
        });
    } catch (error) {
        next(error);
    }
});

// @route   DELETE /api/reviews/:id
// @desc    Delete a review (soft delete)
// @access  Private
router.delete('/:id', protect, authorize('admin'), async (req, res, next) => {
    try {
        const review = await Review.findById(req.params.id);

        if (!review) {
            return res.status(404).json({
                success: false,
                message: 'Review not found'
            });
        }

        review.isActive = false;
        await review.save();

        // Update target rating
        if (review.worker) {
            await Review.updateRating(review.worker, 'worker');
        } else if (review.shop) {
            await Review.updateRating(review.shop, 'shop');
        }

        res.json({
            success: true,
            message: 'Review deleted successfully'
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
