const mongoose = require('mongoose');

const heroSliderSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Title is required']
    },
    subtitle: {
        type: String,
        default: ''
    },
    description: {
        type: String,
        default: ''
    },
    image: {
        type: String,
        required: [true, 'Image is required']
    },
    link: {
        type: String,
        default: ''
    },
    linkText: {
        type: String,
        default: 'Learn More'
    },
    position: {
        type: Number,
        default: 0
    },
    isActive: {
        type: Boolean,
        default: true
    },
    startDate: {
        type: Date
    },
    endDate: {
        type: Date
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
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
heroSliderSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('HeroSlider', heroSliderSchema);
