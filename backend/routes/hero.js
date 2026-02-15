const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const HeroSlider = require('../models/HeroSlider');
const { protect, authorize } = require('../middleware/auth');

// Configure multer for image upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueName = uuidv4() + path.extname(file.originalname);
        cb(null, uniqueName);
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (extname && mimetype) {
        cb(null, true);
    } else {
        cb(new Error('Only image files are allowed'), false);
    }
};

const upload = multer({ 
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter
});

// @route   GET /api/hero
// @desc    Get all active hero sliders
// @access  Public
router.get('/', async (req, res, next) => {
    try {
        const now = new Date();
        
        const sliders = await HeroSlider.find({
            isActive: true,
            $or: [
                { startDate: { $exists: false } },
                { startDate: { $lte: now } }
            ],
            $or: [
                { endDate: { $exists: false } },
                { endDate: { $gte: now } }
            ]
        })
        .select('-createdBy')
        .sort({ position: 1, createdAt: -1 });

        res.json({
            success: true,
            data: { sliders }
        });
    } catch (error) {
        next(error);
    }
});

// @route   GET /api/hero/:id
// @desc    Get hero slider by ID
// @access  Public
router.get('/:id', async (req, res, next) => {
    try {
        const slider = await HeroSlider.findById(req.params.id)
            .populate('createdBy', 'name email');

        if (!slider) {
            return res.status(404).json({
                success: false,
                message: 'Hero slider not found'
            });
        }

        res.json({
            success: true,
            data: { slider }
        });
    } catch (error) {
        next(error);
    }
});

// @route   POST /api/hero
// @desc    Create hero slider (admin only)
// @access  Private/Admin
router.post('/', protect, authorize('admin'), upload.single('image'), async (req, res, next) => {
    try {
        const { title, subtitle, description, link, linkText, position, isActive, startDate, endDate } = req.body;

        let imageUrl = '';
        if (req.file) {
            imageUrl = `/uploads/${req.file.filename}`;
        } else if (req.body.image) {
            imageUrl = req.body.image;
        }

        if (!imageUrl) {
            return res.status(400).json({
                success: false,
                message: 'Image is required'
            });
        }

        const slider = await HeroSlider.create({
            title,
            subtitle: subtitle || '',
            description: description || '',
            image: imageUrl,
            link: link || '',
            linkText: linkText || 'Learn More',
            position: position || 0,
            isActive: isActive !== 'false',
            startDate: startDate || null,
            endDate: endDate || null,
            createdBy: req.user._id
        });

        res.status(201).json({
            success: true,
            message: 'Hero slider created successfully',
            data: { slider }
        });
    } catch (error) {
        next(error);
    }
});

// @route   PUT /api/hero/:id
// @desc    Update hero slider
// @access  Private/Admin
router.put('/:id', protect, authorize('admin'), upload.single('image'), async (req, res, next) => {
    try {
        const { title, subtitle, description, link, linkText, position, isActive, startDate, endDate } = req.body;

        const slider = await HeroSlider.findById(req.params.id);

        if (!slider) {
            return res.status(404).json({
                success: false,
                message: 'Hero slider not found'
            });
        }

        if (title) slider.title = title;
        if (subtitle !== undefined) slider.subtitle = subtitle;
        if (description !== undefined) slider.description = description;
        if (req.file) {
            slider.image = `/uploads/${req.file.filename}`;
        } else if (req.body.image) {
            slider.image = req.body.image;
        }
        if (link !== undefined) slider.link = link;
        if (linkText !== undefined) slider.linkText = linkText;
        if (position !== undefined) slider.position = position;
        if (isActive !== undefined) slider.isActive = isActive;
        if (startDate !== undefined) slider.startDate = startDate;
        if (endDate !== undefined) slider.endDate = endDate;

        await slider.save();

        res.json({
            success: true,
            message: 'Hero slider updated successfully',
            data: { slider }
        });
    } catch (error) {
        next(error);
    }
});

// @route   DELETE /api/hero/:id
// @desc    Delete hero slider
// @access  Private/Admin
router.delete('/:id', protect, authorize('admin'), async (req, res, next) => {
    try {
        const slider = await HeroSlider.findById(req.params.id);

        if (!slider) {
            return res.status(404).json({
                success: false,
                message: 'Hero slider not found'
            });
        }

        await slider.deleteOne();

        res.json({
            success: true,
            message: 'Hero slider deleted successfully'
        });
    } catch (error) {
        next(error);
    }
});

// @route   PUT /api/hero/reorder
// @desc    Reorder hero sliders
// @access  Private/Admin
router.put('/reorder', protect, authorize('admin'), async (req, res, next) => {
    try {
        const { order } = req.body; // Array of slider IDs in desired order

        if (!Array.isArray(order)) {
            return res.status(400).json({
                success: false,
                message: 'Order must be an array of slider IDs'
            });
        }

        // Update positions
        for (let i = 0; i < order.length; i++) {
            await HeroSlider.findByIdAndUpdate(order[i], { position: i });
        }

        const sliders = await HeroSlider.find().sort({ position: 1 });

        res.json({
            success: true,
            message: 'Hero sliders reordered successfully',
            data: { sliders }
        });
    } catch (error) {
        next(error);
    }
});

// @route   PUT /api/hero/:id/toggle
// @desc    Toggle hero slider active status
// @access  Private/Admin
router.put('/:id/toggle', protect, authorize('admin'), async (req, res, next) => {
    try {
        const slider = await HeroSlider.findById(req.params.id);

        if (!slider) {
            return res.status(404).json({
                success: false,
                message: 'Hero slider not found'
            });
        }

        slider.isActive = !slider.isActive;
        await slider.save();

        res.json({
            success: true,
            message: `Hero slider ${slider.isActive ? 'activated' : 'deactivated'}`,
            data: { slider }
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
