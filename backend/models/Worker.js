const mongoose = require('mongoose');

const workerSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    profession: {
        type: String,
        required: [true, 'Profession is required'],
        enum: ['plumber', 'electrician', 'carpenter', 'painter', 'cleaner', 'driver', 'mechanic', 'appliance', 'pest_control', 'other']
    },
    skills: [{
        type: String
    }],
    experience: {
        type: Number,
        default: 0
    },
    description: {
        type: String,
        default: ''
    },
    hourlyRate: {
        type: Number,
        default: 0
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    verificationStatus: {
        type: String,
        enum: ['pending', 'verified', 'rejected'],
        default: 'pending'
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
        },
        address: {
            type: String,
            default: ''
        },
        city: {
            type: String,
            default: ''
        },
        state: {
            type: String,
            default: ''
        },
        pincode: {
            type: String,
            default: ''
        }
    },
    serviceArea: {
        type: Number,
        default: 10 // in kilometers
    },
    availability: {
        monday: { start: String, end: String, available: Boolean },
        tuesday: { start: String, end: String, available: Boolean },
        wednesday: { start: String, end: String, available: Boolean },
        thursday: { start: String, end: String, available: Boolean },
        friday: { start: String, end: String, available: Boolean },
        saturday: { start: String, end: String, available: Boolean },
        sunday: { start: String, end: String, available: Boolean }
    },
    documents: [{
        type: { type: String },
        url: String,
        verified: Boolean
    }],
    profileImage: {
        type: String,
        default: ''
    },
    rating: {
        average: { type: Number, default: 0 },
        count: { type: Number, default: 0 }
    },
    completedJobs: {
        type: Number,
        default: 0
    },
    isAvailable: {
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
    },
    trackingId: {
        type: String,
        unique: true,
        sparse: true
    },
    applicationStatus: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
    }
});

// Index for geospatial queries
workerSchema.index({ location: '2dsphere' });

// Update timestamp
workerSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('Worker', workerSchema);
