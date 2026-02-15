const mongoose = require('mongoose');

const trackingSchema = new mongoose.Schema({
    serviceRequest: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ServiceRequest',
        required: true
    },
    worker: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Worker',
        required: true
    },
    customer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    currentLocation: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point'
        },
        coordinates: {
            type: [Number],
            default: [0, 0]
        },
        address: {
            type: String,
            default: ''
        },
        timestamp: {
            type: Date,
            default: Date.now
        }
    },
    destination: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point'
        },
        coordinates: {
            type: [Number],
            default: [0, 0]
        },
        address: {
            type: String,
            default: ''
        }
    },
    status: {
        type: String,
        enum: ['en_route', 'arrived', 'working', 'completed'],
        default: 'en_route'
    },
    isLive: {
        type: Boolean,
        default: true
    },
    locationHistory: [{
        coordinates: [Number],
        address: String,
        timestamp: {
            type: Date,
            default: Date.now
        }
    }],
    estimatedArrival: {
        type: Date
    },
    startedAt: {
        type: Date,
        default: Date.now
    },
    endedAt: {
        type: Date
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

// Index for geospatial queries
trackingSchema.index({ currentLocation: '2dsphere' });
trackingSchema.index({ serviceRequest: 1, worker: 1 });

// Update timestamp
trackingSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('Tracking', trackingSchema);
