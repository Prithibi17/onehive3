const nodemailer = require('nodemailer');
const { v4: uuidv4 } = require('uuid');

// Email transporter
const createTransporter = () => {
    return nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    });
};

// Send email
exports.sendEmail = async (options) => {
    try {
        const transporter = createTransporter();
        
        const mailOptions = {
            from: process.env.SMTP_USER || 'noreply@onehive.com',
            to: options.email,
            subject: options.subject,
            html: options.message
        };

        await transporter.sendMail(mailOptions);
        return true;
    } catch (error) {
        console.error('Email send error:', error.message);
        // For testing: log OTP if email contains it
        const otpMatch = options.message && options.message.match(/(\d{6})/);
        if (otpMatch) {
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('📧 OTP FOR TESTING (Email failed):');
            console.log('   To:', options.email);
            console.log('   OTP:', otpMatch[1]);
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        }
        return false;
    }
};

// Generate OTP
exports.generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

// Generate reset token
exports.generateResetToken = () => {
    return uuidv4();
};

// Format response
exports.formatResponse = (success, message, data = null) => {
    const response = { success, message };
    if (data !== null) {
        response.data = data;
    }
    return response;
};

// Pagination
exports.pagination = (page = 1, limit = 10) => {
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    
    return {
        startIndex,
        endIndex,
        page: parseInt(page),
        limit: parseInt(limit)
    };
};

// Distance calculation (Haversine formula)
exports.calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's radius in km
    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);
    const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

function toRadians(degrees) {
    return degrees * (Math.PI / 180);
}
