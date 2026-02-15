# OneHive Backend API

## Overview
OneHive is a service marketplace platform connecting customers with service providers (workers) and shops. This backend is built with Node.js, Express, and MongoDB.

## Prerequisites
- Node.js (v14+)
- MongoDB (v4.4+)
- npm or yarn

## Installation

1. Navigate to the backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
   - Copy `.env.example` to `.env`
   - Update the MongoDB connection string
   - Configure Google OAuth credentials (optional)
   - Configure email settings for OTP (optional)

4. Start MongoDB:
```bash
# Using local MongoDB
mongod
```

5. Start the server:
```bash
npm start
# or for development
npm run dev
```

The API will be available at `http://localhost:3000`

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login user |
| POST | `/api/auth/google` | Google OAuth login |
| POST | `/api/auth/send-otp` | Send OTP to email |
| POST | `/api/auth/verify-otp` | Verify OTP |
| POST | `/api/auth/forgot-password` | Request password reset |
| POST | `/api/auth/reset-password` | Reset password |
| GET | `/api/auth/me` | Get current user |
| PUT | `/api/auth/profile` | Update profile |
| PUT | `/api/auth/change-password` | Change password |

### Users
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users` | Get all users (admin) |
| GET | `/api/users/:id` | Get user by ID |
| PUT | `/api/users/:id` | Update user |
| DELETE | `/api/users/:id` | Deactivate user |
| GET | `/api/users/workers/list` | Get all workers |
| GET | `/api/users/shops/list` | Get all shops |

### Workers
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/workers/register` | Register as worker |
| GET | `/api/workers/profile` | Get worker profile |
| PUT | `/api/workers/profile` | Update worker profile |
| PUT | `/api/workers/location` | Update location |
| GET | `/api/workers/:id` | Get worker by ID |
| GET | `/api/workers/nearby` | Find nearby workers |
| GET | `/api/workers/search` | Search workers |
| GET | `/api/workers/available/requests` | Get available requests |
| PUT | `/api/workers/verify/:id` | Verify worker (admin) |

### Shops
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/shops` | Create shop |
| GET | `/api/shops/profile` | Get shop profile |
| PUT | `/api/shops/profile` | Update shop profile |
| GET | `/api/shops/:id` | Get shop by ID |
| GET | `/api/shops` | Get all shops |
| GET | `/api/shops/nearby` | Find nearby shops |
| POST | `/api/shops/products` | Add product |
| PUT | `/api/shops/products/:productId` | Update product |
| DELETE | `/api/shops/products/:productId` | Delete product |

### Service Requests
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/services` | Create service request |
| GET | `/api/services` | Get user's services |
| GET | `/api/services/:id` | Get service by ID |
| PUT | `/api/services/:id/accept` | Accept request (worker) |
| PUT | `/api/services/:id/reject` | Reject request |
| PUT | `/api/services/:id/start` | Start service |
| PUT | `/api/services/:id/complete` | Complete service |
| PUT | `/api/services/:id/rate` | Rate service |
| GET | `/api/services/nearby/requests` | Get nearby requests |

### Tracking
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/tracking` | Start tracking |
| PUT | `/api/tracking/:id/location` | Update location |
| PUT | `/api/tracking/:id/status` | Update status |
| GET | `/api/tracking/service/:serviceId` | Get service tracking |
| GET | `/api/tracking/live` | Get all live tracking |
| GET | `/api/tracking/history` | Get tracking history |
| PUT | `/api/tracking/:id/end` | End tracking |

### Reviews
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/reviews` | Create review |
| GET | `/api/reviews/worker/:id` | Get worker reviews |
| GET | `/api/reviews/shop/:id` | Get shop reviews |
| GET | `/api/reviews/user/:id` | Get user reviews |
| PUT | `/api/reviews/:id` | Update review |
| DELETE | `/api/reviews/:id` | Delete review |

### Hero Slider
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/hero` | Get active sliders |
| GET | `/api/hero/:id` | Get slider by ID |
| POST | `/api/hero` | Create slider (admin) |
| PUT | `/api/hero/:id` | Update slider |
| DELETE | `/api/hero/:id` | Delete slider |
| PUT | `/api/hero/reorder` | Reorder sliders |
| PUT | `/api/hero/:id/toggle` | Toggle slider |

## Authentication

Most endpoints require authentication using JWT token. Include the token in the Authorization header:

```
Authorization: Bearer <your_token>
```

### User Roles
- `customer` - Regular users seeking services
- `worker` - Service providers
- `shop` - Shop owners
- `admin` - Platform administrators

## Environment Variables

```env
PORT=3000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/onehive
JWT_SECRET=your_jwt_secret
JWT_EXPIRE=7d
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_email_password
FRONTEND_URL=http://localhost:5500
```

## API Response Format

Success response:
```json
{
  "success": true,
  "message": "Success message",
  "data": { }
}
```

Error response:
```json
{
  "success": false,
  "message": "Error message"
}
```

## Running in Production

1. Set `NODE_ENV=production`
2. Use a production MongoDB instance (MongoDB Atlas)
3. Configure proper JWT_SECRET
4. Use PM2 for process management:
```bash
pm2 start server.js
```
