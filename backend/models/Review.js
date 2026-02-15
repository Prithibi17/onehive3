const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
    serviceRequest: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ServiceRequest',
        required: true
    },
    reviewer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    reviewee: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    worker: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Worker'
    },
    shop: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Shop'
    },
    rating: {
        type: Number,
        required: [true, 'Rating is required'],
        min: 1,
        max: 5
    },
    review: {
        type: String,
        default: ''
    },
    reviewType: {
        type: String,
        enum: ['worker_to_customer', 'customer_to_worker', 'customer_to_shop'],
        required: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Update timestamp
reviewSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

// Static method to update rating
reviewSchema.statics.updateRating = async function(targetId, targetType) {
    const match = targetType === 'worker' 
        ? { worker: targetId }
        : { shop: targetId };
    
    const result = await this.aggregate([
        { $match: { ...match, isActive: true } },
        {
            $group: {
                _id: null,
                averageRating: { $avg: '$rating' },
                count: { $sum: 1 }
            }
        }
    ]);
    
    if (result.length > 0) {
        const Model = targetType === 'worker' ? mongoose.model('Worker') : mongoose.model('Shop');
        await Model.findByIdAndUpdate(targetId, {
            'rating.average': Math.round(result[0].averageRating * 10) / 10,
            'rating.count': result[0].count
        });
    }
};

module.exports = mongoose.model('Review', reviewSchema);
