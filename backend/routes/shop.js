const express = require('express');
const router = express.Router();
const Shop = require('../models/Shop');
const User = require('../models/User');
const { protect, authorize, optionalAuth } = require('../middleware/auth');
const { calculateDistance } = require('../utils/helpers');

// @route   POST /api/shops
// @desc    Create a shop
// @access  Private
router.post('/', protect, async (req, res, next) => {
    try {
        const { shopName, description, category, logo, coverImage, address, location, phone, email, openingHours } = req.body;

        // Check if already has a shop
        const existingShop = await Shop.findOne({ user: req.user._id });
        if (existingShop) {
            return res.status(400).json({
                success: false,
                message: 'You already have a shop'
            });
        }

        // Create shop
        const shop = await Shop.create({
            user: req.user._id,
            shopName,
            description: description || '',
            category,
            logo: logo || '',
            coverImage: coverImage || '',
            address: address || {},
            location: {
                type: 'Point',
                coordinates: location?.coordinates || [0, 0]
            },
            phone: phone || '',
            email: email || req.user.email,
            openingHours: openingHours || {
                monday: { open: '09:00', close: '21:00', closed: false },
                tuesday: { open: '09:00', close: '21:00', closed: false },
                wednesday: { open: '09:00', close: '21:00', closed: false },
                thursday: { open: '09:00', close: '21:00', closed: false },
                friday: { open: '09:00', close: '21:00', closed: false },
                saturday: { open: '09:00', close: '21:00', closed: false },
                sunday: { open: '10:00', close: '18:00', closed: false }
            }
        });

        // Update user role
        await User.findByIdAndUpdate(req.user._id, { role: 'shop' });

        res.status(201).json({
            success: true,
            message: 'Shop created successfully',
            data: { shop }
        });
    } catch (error) {
        next(error);
    }
});

// @route   GET /api/shops/profile
// @desc    Get current shop profile
// @access  Private/Shop
router.get('/profile', protect, authorize('shop', 'admin'), async (req, res, next) => {
    try {
        const shop = await Shop.findOne({ user: req.user._id })
            .populate('user', 'name email phone avatar');

        if (!shop) {
            return res.status(404).json({
                success: false,
                message: 'Shop not found'
            });
        }

        res.json({
            success: true,
            data: { shop }
        });
    } catch (error) {
        next(error);
    }
});

// @route   PUT /api/shops/profile
// @desc    Update shop profile
// @access  Private/Shop
router.put('/profile', protect, authorize('shop', 'admin'), async (req, res, next) => {
    try {
        const { shopName, description, category, logo, coverImage, address, location, phone, email, openingHours, isOpen } = req.body;

        const shop = await Shop.findOne({ user: req.user._id });

        if (!shop) {
            return res.status(404).json({
                success: false,
                message: 'Shop not found'
            });
        }

        if (shopName) shop.shopName = shopName;
        if (description !== undefined) shop.description = description;
        if (category) shop.category = category;
        if (logo) shop.logo = logo;
        if (coverImage) shop.coverImage = coverImage;
        if (address) shop.address = { ...shop.address.toObject(), ...address };
        if (location) {
            shop.location = {
                type: 'Point',
                coordinates: location.coordinates || shop.location.coordinates
            };
        }
        if (phone) shop.phone = phone;
        if (email) shop.email = email;
        if (openingHours) shop.openingHours = openingHours;
        if (isOpen !== undefined) shop.isOpen = isOpen;

        await shop.save();

        res.json({
            success: true,
            message: 'Shop updated successfully',
            data: { shop }
        });
    } catch (error) {
        next(error);
    }
});

// @route   GET /api/shops/:id
// @desc    Get shop by ID
// @access  Public
router.get('/:id', optionalAuth, async (req, res, next) => {
    try {
        const shop = await Shop.findById(req.params.id)
            .populate('user', 'name phone email avatar');

        if (!shop) {
            return res.status(404).json({
                success: false,
                message: 'Shop not found'
            });
        }

        res.json({
            success: true,
            data: { shop }
        });
    } catch (error) {
        next(error);
    }
});

// @route   GET /api/shops
// @desc    Get all shops
// @access  Public
router.get('/', optionalAuth, async (req, res, next) => {
    try {
        const { page = 1, limit = 10, category, city, search } = req.query;

        const query = { isVerified: true };
        if (category) query.category = category;
        if (city) query['address.city'] = { $regex: city, $options: 'i' };
        if (search) {
            query.$or = [
                { shopName: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ];
        }

        const shops = await Shop.find(query)
            .populate('user', 'name phone avatar')
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .sort({ 'rating.average': -1 });

        const count = await Shop.countDocuments(query);

        res.json({
            success: true,
            data: {
                shops: shops.map(s => ({
                    id: s._id,
                    shopName: s.shopName,
                    description: s.description,
                    category: s.category,
                    logo: s.logo,
                    coverImage: s.coverImage,
                    address: s.address,
                    phone: s.phone,
                    rating: s.rating,
                    isOpen: s.isOpen
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

// @route   GET /api/shops/nearby
// @desc    Find nearby shops
// @access  Public
router.get('/nearby', optionalAuth, async (req, res, next) => {
    try {
        const { latitude, longitude, category, radius = 10 } = req.query;

        if (!latitude || !longitude) {
            return res.status(400).json({
                success: false,
                message: 'Latitude and longitude are required'
            });
        }

        const query = {
            isVerified: true,
            isOpen: true,
            location: {
                $near: {
                    $geometry: {
                        type: 'Point',
                        coordinates: [parseFloat(longitude), parseFloat(latitude)]
                    },
                    $maxDistance: parseFloat(radius) * 1000
                }
            }
        };

        if (category) query.category = category;

        const shops = await Shop.find(query)
            .populate('user', 'name phone avatar');

        res.json({
            success: true,
            data: {
                shops: shops.map(s => ({
                    id: s._id,
                    shopName: s.shopName,
                    category: s.category,
                    logo: s.logo,
                    address: s.address,
                    phone: s.phone,
                    rating: s.rating,
                    distance: calculateDistance(
                        parseFloat(latitude),
                        parseFloat(longitude),
                        s.location.coordinates[1],
                        s.location.coordinates[0]
                    ).toFixed(2)
                }))
            }
        });
    } catch (error) {
        next(error);
    }
});

// @route   POST /api/shops/products
// @desc    Add product to shop
// @access  Private/Shop
router.post('/products', protect, authorize('shop'), async (req, res, next) => {
    try {
        const { name, description, price, category, image, stock } = req.body;

        const shop = await Shop.findOne({ user: req.user._id });

        if (!shop) {
            return res.status(404).json({
                success: false,
                message: 'Shop not found'
            });
        }

        shop.products.push({
            name,
            description: description || '',
            price,
            category,
            image: image || '',
            stock: stock || 0,
            isAvailable: true
        });

        await shop.save();

        res.status(201).json({
            success: true,
            message: 'Product added successfully',
            data: { products: shop.products }
        });
    } catch (error) {
        next(error);
    }
});

// @route   PUT /api/shops/products/:productId
// @desc    Update product
// @access  Private/Shop
router.put('/products/:productId', protect, authorize('shop'), async (req, res, next) => {
    try {
        const { name, description, price, category, image, stock, isAvailable } = req.body;

        const shop = await Shop.findOne({ user: req.user._id });

        if (!shop) {
            return res.status(404).json({
                success: false,
                message: 'Shop not found'
            });
        }

        const product = shop.products.id(req.params.productId);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        if (name) product.name = name;
        if (description !== undefined) product.description = description;
        if (price) product.price = price;
        if (category) product.category = category;
        if (image) product.image = image;
        if (stock !== undefined) product.stock = stock;
        if (isAvailable !== undefined) product.isAvailable = isAvailable;

        await shop.save();

        res.json({
            success: true,
            message: 'Product updated successfully',
            data: { products: shop.products }
        });
    } catch (error) {
        next(error);
    }
});

// @route   DELETE /api/shops/products/:productId
// @desc    Delete product
// @access  Private/Shop
router.delete('/products/:productId', protect, authorize('shop'), async (req, res, next) => {
    try {
        const shop = await Shop.findOne({ user: req.user._id });

        if (!shop) {
            return res.status(404).json({
                success: false,
                message: 'Shop not found'
            });
        }

        shop.products.pull(req.params.productId);
        await shop.save();

        res.json({
            success: true,
            message: 'Product deleted successfully',
            data: { products: shop.products }
        });
    } catch (error) {
        next(error);
    }
});

// @route   PUT /api/shops/verify/:id
// @desc    Verify shop (admin only)
// @access  Private/Admin
router.put('/verify/:id', protect, authorize('admin'), async (req, res, next) => {
    try {
        const { isVerified } = req.body;

        const shop = await Shop.findById(req.params.id);

        if (!shop) {
            return res.status(404).json({
                success: false,
                message: 'Shop not found'
            });
        }

        shop.isVerified = isVerified;
        await shop.save();

        res.json({
            success: true,
            message: 'Shop verification updated',
            data: { shop }
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
