const mongoose = require('mongoose');

const serviceRequestSchema = new mongoose.Schema({
    customer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    worker: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Worker'
    },
    serviceType: {
        type: String,
        required: [true, 'Service type is required'],
        enum: ['plumber', 'electrician', 'carpenter', 'painter', 'cleaner', 'driver', 'mechanic', 'appliance', 'pest_control', 'other']
    },
    title: {
        type: String,
        required: [true, 'Title is required']
    },
    description: {
        type: String,
        required: [true, 'Description is required']
    },
    address: {
        street: { type: String, default: '' },
        city: { type: String, default: '' },
        state: { type: String, default: '' },
        pincode: { type: String, default: '' }
    },
    location: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point'
        },
        coordinates: {
            type: [Number],
            default: [0, 0]
        }
    },
    scheduledDate: {
        type: Date
    },
    scheduledTime: {
        type: String
    },
    estimatedDuration: {
        type: Number, // in hours
        default: 1
    },
    estimatedCost: {
        type: Number,
        default: 0
    },
    status: {
        type: String,
        enum: ['pending', 'accepted', 'rejected', 'in_progress', 'completed', 'cancelled'],
        default: 'pending'
    },
    acceptedAt: {
        type: Date
    },
    startedAt: {
        type: Date
    },
    completedAt: {
        type: Date
    },
    cancelledAt: {
        type: Date
    },
    cancellationReason: {
        type: String
    },
    customerRating: {
        type: Number,
        min: 1,
        max: 5
    },
    customerReview: {
        type: String
    },
    workerRating: {
        type: Number,
        min: 1,
        max: 5
    },
    workerReview: {
        type: String
    },
    images: [{
        type: String
    }],
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Index for geospatial queries
serviceRequestSchema.index({ location: '2dsphere' });

// Update timestamp
serviceRequestSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('ServiceRequest', serviceRequestSchema);
