const express = require('express');
const router = express.Router();
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const Worker = require('../models/Worker');
const { generateToken, protect } = require('../middleware/auth');
const { generateOTP, generateResetToken, sendEmail } = require('../utils/helpers');

// Google OAuth Client
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post('/register', async (req, res, next) => {
    try {
        const name = req.body.name ? req.body.name.trim() : '';
        const email = req.body.email ? req.body.email.trim().toLowerCase() : '';
        const password = req.body.password;
        const phone = req.body.phone ? req.body.phone.trim() : '';
        const role = req.body.role;

        // Validate role - only allow 'customer' or 'worker'
        const allowedRoles = ['customer', 'worker'];
        const userRole = allowedRoles.includes(role) ? role : 'customer';

        // Check if user exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'Email already registered'
            });
        }

        // Create user
        const user = await User.create({
            name,
            email,
            password,
            phone,
            role: userRole
        });

        // Send welcome email
        await sendEmail({
            email: user.email,
            subject: 'Welcome to OneHive',
            message: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #1a365d;">Welcome to OneHive</h2>
                    <p>Dear ${user.name},</p>
                    <p>Welcome to OneHive.</p>
                    <p>Your account has been successfully created.</p>
                    <p>You can now access our platform to explore trusted services, connect with verified professionals, and manage your requests.</p>
                    <p>If this registration was not initiated by you, please contact our support team immediately.</p>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                    <p style="color: #999; font-size: 12px;">Regards,<br>OneHive Team</p>
                </div>
            `
        });

        // Generate token
        const token = generateToken(user._id);

        res.status(201).json({
            success: true,
            message: 'Registration successful',
            data: {
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    phone: user.phone,
                    role: user.role
                },
                token
            }
        });
    } catch (error) {
        next(error);
    }
});

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', async (req, res, next) => {
    try {
        const email = req.body.email ? req.body.email.trim().toLowerCase() : '';
        const { password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please provide email and password'
            });
        }

        // Find user with password
        const user = await User.findOne({ email }).select('+password');
        
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Check if using OAuth
        if (user.isOAuth && !user.password) {
            return res.status(401).json({
                success: false,
                message: 'Please login with Google'
            });
        }

        // Check password
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Check if active
        if (!user.isActive) {
            return res.status(401).json({
                success: false,
                message: 'Account is deactivated'
            });
        }

        // Generate token
        const token = generateToken(user._id);

        res.json({
            success: true,
            message: 'Login successful',
            data: {
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    phone: user.phone,
                    role: user.role,
                    avatar: user.avatar
                },
                token
            }
        });
    } catch (error) {
        next(error);
    }
});

// @route   POST /api/auth/google
// @desc    Google OAuth login/register
// @access  Public
router.post('/google', async (req, res, next) => {
    try {
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({
                success: false,
                message: 'Google token is required'
            });
        }

        // Verify Google token
        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: process.env.GOOGLE_CLIENT_ID
        });

        const payload = ticket.getPayload();
        const { sub: googleId, email, name, picture } = payload;

        // Find or create user
        let user = await User.findOne({ googleId });
        
        if (!user) {
            // Check if user exists with same email
            user = await User.findOne({ email });
            
            if (user) {
                // Link Google account to existing user
                user.googleId = googleId;
                user.isOAuth = true;
                if (!user.avatar) user.avatar = picture;
                await user.save();
            } else {
                // Create new user
                user = await User.create({
                    name,
                    email,
                    googleId,
                    isOAuth: true,
                    avatar: picture,
                    role: 'customer'
                });
            }
        }

        // Check if active
        if (!user.isActive) {
            return res.status(401).json({
                success: false,
                message: 'Account is deactivated'
            });
        }

        // Generate token
        const authToken = generateToken(user._id);

        res.json({
            success: true,
            message: 'Google login successful',
            data: {
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    phone: user.phone,
                    role: user.role,
                    avatar: user.avatar
                },
                token: authToken
            }
        });
    } catch (error) {
        console.error('Google auth error:', error);
        res.status(401).json({
            success: false,
            message: 'Google authentication failed'
        });
    }
});

// @route   POST /api/auth/send-otp
// @desc    Send OTP for verification
// @access  Public
router.post('/send-otp', async (req, res, next) => {
    try {
        const email = req.body.email ? req.body.email.trim().toLowerCase() : '';

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email is required'
            });
        }

        console.log("[FORGOT] Searching for email:", email);
        
        const user = await User.findOne({ email });
        console.log("[FORGOT] User found:", user ? user.email : 'NOT FOUND');
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found with this email'
            });
        }

        // Generate OTP
        const otp = generateOTP();
        const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        user.otp = otp;
        user.otpExpires = otpExpires;
        await user.save();

        // Send OTP email
        const emailSent = await sendEmail({
            email: user.email,
            subject: 'OneHive Security Code - OTP Verification',
            message: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #1a365d;">OneHive Security Code</h2>
                    <p>Dear ${user.name},</p>
                    <p>We received a request to verify your identity.</p>
                    <p>Your One-Time Password (OTP) is:</p>
                    <h1 style="background: #f7f7f7; padding: 15px; text-align: center; letter-spacing: 5px; color: #1a365d;">${otp}</h1>
                    <p>This code will expire in 10 minutes.</p>
                    <p>If you did not request this, please ignore this email.</p>
                    <p style="color: #666; font-size: 12px; margin-top: 30px;">For security reasons, do not share this code with anyone.</p>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                    <p style="color: #999; font-size: 12px;">Regards,<br>OneHive Security Team</p>
                </div>
            `
        });

        // Return success even if email fails (OTP is saved in DB - check server console for OTP)
        res.json({
            success: true,
            message: emailSent ? 'OTP sent to your email' : 'OTP generated (check server console for OTP)'
        });
    } catch (error) {
        next(error);
    }
});

// @route   POST /api/auth/verify-otp
// @desc    Verify OTP
// @access  Public
router.post('/verify-otp', async (req, res, next) => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({
                success: false,
                message: 'Email and OTP are required'
            });
        }

        const user = await User.findOne({ email }).select('+otp +otpExpires');
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Check OTP
        if (user.otp !== otp) {
            return res.status(400).json({
                success: false,
                message: 'Invalid OTP'
            });
        }

        // Check expiry
        if (user.otpExpires < new Date()) {
            return res.status(400).json({
                success: false,
                message: 'OTP has expired'
            });
        }

        // Clear OTP
        user.otp = undefined;
        user.otpExpires = undefined;
        await user.save();

        res.json({
            success: true,
            message: 'OTP verified successfully'
        });
    } catch (error) {
        next(error);
    }
});

// @route   POST /api/auth/reset-password
// @desc    Reset password using OTP
// @access  Public
router.post('/reset-password', async (req, res, next) => {
    try {
        const { email, newPassword } = req.body;

        if (!email || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Email and new password are required'
            });
        }

        const user = await User.findOne({ email });
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        user.password = newPassword;
        await user.save();

        // Send password change confirmation email
        await sendEmail({
            email: user.email,
            subject: 'OneHive Password Updated Successfully',
            message: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #1a365d;">Password Updated Successfully</h2>
                    <p>Dear ${user.name},</p>
                    <p>Your OneHive account password has been successfully updated.</p>
                    <p>If you did not perform this action, please reset your password immediately or contact our support team.</p>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                    <p style="color: #999; font-size: 12px;">Regards,<br>OneHive Security Team</p>
                </div>
            `
        });

        res.json({
            success: true,
            message: 'Password reset successful'
        });
    } catch (error) {
        next(error);
    }
});

// @route   POST /api/auth/forgot-password
// @desc    Send forgot password email
// @access  Public
router.post('/forgot-password', async (req, res, next) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email is required'
            });
        }

        const user = await User.findOne({ email });
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found with this email'
            });
        }

        // Generate reset token
        const resetToken = generateResetToken();
        user.resetPasswordToken = resetToken;
        user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
        await user.save();

        // Send password reset email
        const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
        const emailSent = await sendEmail({
            email: user.email,
            subject: 'OneHive Password Reset Request',
            message: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #1a365d;">Password Reset Request</h2>
                    <p>Dear ${user.name},</p>
                    <p>We received a request to reset your OneHive account password.</p>
                    <p>Click the link below to reset your password:</p>
                    <p style="margin: 20px 0;"><a href="${resetUrl}" style="background: #1a365d; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">Reset Password</a></p>
                    <p>This link will expire in 1 hour.</p>
                    <p>If you did not request this, please ignore this email.</p>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                    <p style="color: #999; font-size: 12px;">Regards,<br>OneHive Security Team</p>
                </div>
            `
        });

        if (!emailSent) {
            user.resetPasswordToken = undefined;
            user.resetPasswordExpires = undefined;
            await user.save();
            
            return res.status(500).json({
                success: false,
                message: 'Failed to send reset email'
            });
        }

        res.json({
            success: true,
            message: 'Password reset email sent'
        });
    } catch (error) {
        next(error);
    }
});

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
router.get('/me', protect, async (req, res, next) => {
    try {
        const user = await User.findById(req.user._id);
        
        let additionalData = {};
        
        // If worker, include worker profile
        if (user.role === 'worker') {
            const worker = await Worker.findOne({ user: user._id });
            additionalData.worker = worker;
        }

        res.json({
            success: true,
            data: {
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    phone: user.phone,
                    role: user.role,
                    avatar: user.avatar,
                    isVerified: user.isVerified
                },
                ...additionalData
            }
        });
    } catch (error) {
        next(error);
    }
});

// @route   PUT /api/auth/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', protect, async (req, res, next) => {
    try {
        const { name, phone, avatar } = req.body;

        const user = await User.findById(req.user._id);
        
        if (name) user.name = name;
        if (phone) user.phone = phone;
        if (avatar) user.avatar = avatar;

        await user.save();

        res.json({
            success: true,
            message: 'Profile updated successfully',
            data: {
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    phone: user.phone,
                    role: user.role,
                    avatar: user.avatar
                }
            }
        });
    } catch (error) {
        next(error);
    }
});

// @route   PUT /api/auth/change-password
// @desc    Change password
// @access  Private
router.put('/change-password', protect, async (req, res, next) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Current password and new password are required'
            });
        }

        const user = await User.findById(req.user._id).select('+password');

        // Check current password
        const isMatch = await user.comparePassword(currentPassword);
        if (!isMatch) {
            return res.status(400).json({
                success: false,
                message: 'Current password is incorrect'
            });
        }

        user.password = newPassword;
        await user.save();

        res.json({
            success: true,
            message: 'Password changed successfully'
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
