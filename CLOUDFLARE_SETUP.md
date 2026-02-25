# Cloudflare Worker Deployment Guide

## Overview
Your updated `worker.js` file includes significant security improvements and new features. Follow these steps to deploy it to Cloudflare Workers.

## Step 1: Copy Worker Code
1. Open `worker.js` in this repository
2. Copy the **entire file contents**
3. Go to your Cloudflare Dashboard → Workers → Your Worker
4. Paste the code into the editor
5. Save and Deploy

## Step 2: Configure Bindings in Cloudflare Dashboard

### A. Database (D1)
- **Name:** `DB`
- **Type:** D1 Database
- **Database:** Select or create your database
- **Action:** Associate

### B. KV Namespace
- **Name:** `KV`
- **Type:** KV Namespace
- **Namespace:** Create or select existing
- **Action:** Associate

### C. Environment Variables (Encrypted)
Go to Settings → Variables → Add variable

1. **JWT_SECRET** (Recommended: change from default)
   - Type: Secret
   - Value: Generate a strong random string (e.g., `openssl rand -base64 32`)
   - ⚠️ Keep this secret! It signs all JWT tokens

2. **ALLOWED_ORIGIN** (Optional)
   - Type: Plaintext
   - Value: `https://oklahomabashi.pages.dev` (or your domain)
   - Default: `https://oklahomabashi.pages.dev` (if not set)

3. **STRIPE_SECRET_KEY** (Optional - for future payment processing)
   - Type: Secret
   - Value: Your Stripe secret key (if using Stripe)

## Step 3: Initialize Database Schema

Run this SQL in your Cloudflare D1 Console:

```sql
-- Copy entire contents from schema.sql file
-- This file is included in the repo
```

Or use the D1 CLI:
```bash
wrangler d1 execute your-database-name --file=./schema.sql
```

## Step 4: Test the API

### Register User
```bash
curl -X POST https://your-worker.com/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123",
    "full_name": "John Doe"
  }'
```

### Login
```bash
curl -X POST https://your-worker.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123"
  }'
```

### Get Events
```bash
curl https://your-worker.com/events
```

## Security Improvements Made

✅ **PBKDF2 Password Hashing** (100k iterations + salt)
- Replaces weak SHA-256 hashing
- Resistant to brute force attacks
- Each password has unique salt

✅ **JWT Expiration Validation**
- Tokens expire after 24 hours
- Validates `exp` claim on every protected request

✅ **Input Validation**
- Email format validation
- Password strength requirements (8+ chars, uppercase, lowercase, number)
- Full name length validation

✅ **Rate Limiting**
- Registration: 3 attempts per 5 minutes per IP
- Login: 5 attempts per minute per IP
- Prevents brute force attacks

✅ **CORS Restriction**
- Configurable `ALLOWED_ORIGIN` instead of `*`
- Only your domain can access the API

✅ **Proper Error Handling**
- JSON parsing errors caught with try-catch
- Detailed error messages for debugging

✅ **Admin Endpoints**
- Create, update, delete events (admin only)
- Mark tickets as "used" at door entry
- View all users and statistics

## New Features

### Admin Event Management
```bash
# Create Event
POST /admin/events
Authorization: Bearer {token}
{
  "title": "Pohela Boishakh",
  "description": "Bengali New Year celebration",
  "date": 1713052800,
  "location": "Scissortail Park",
  "price": 2500,
  "image_url": "https://...",
  "capacity": 500
}

# Update Event
PUT /admin/events/{event_id}
Authorization: Bearer {token}

# Delete Event
DELETE /admin/events/{event_id}
Authorization: Bearer {token}
```

### Ticket Validation (Door Entry)
```bash
# Mark ticket as used/validated
PUT /admin/tickets/{ticket_id}
Authorization: Bearer {token}
```

### Admin Statistics
```bash
GET /admin/stats
Authorization: Bearer {token}

Response:
{
  "users": 150,
  "tickets": 450,
  "events": 12,
  "revenue": 125000
}
```

### List All Users (Admin)
```bash
GET /admin/users
Authorization: Bearer {token}
```

## Updated Database Schema

Changes from original:
- `users.created_at`: Changed to TEXT format (ISO 8601 datetime)
- `events.created_at`: Changed to TEXT format
- `tickets.created_at`: Renamed from `purchase_date`, TEXT format
- `tickets.used_at`: New field to track when ticket was validated
- `tickets.status`: Now tracked properly (valid/used/refunded)
- Added indexes on `status` and `email` for performance

## Environment Variables for Frontend

Update your `.env` file in the frontend project:

```env
VITE_API_URL=https://your-worker.com
```

## Troubleshooting

### Issue: "JWT verification failed"
- **Cause:** JWT_SECRET in worker doesn't match what was used to create token
- **Fix:** Ensure JWT_SECRET is set and consistent

### Issue: "Database binding not found"
- **Cause:** Missing or incorrectly named binding in Cloudflare settings
- **Fix:** Check binding name is exactly `DB` in dashboard

### Issue: "CORS error in browser"
- **Cause:** Your domain doesn't match ALLOWED_ORIGIN
- **Fix:** Update ALLOWED_ORIGIN env var in Cloudflare

### Issue: "Rate limit exceeded"
- **Cause:** Too many requests from same IP
- **Fix:** Wait 5 minutes for registration, 1 minute for login
- **Note:** This is a security feature

## Next Steps

1. ✅ Deploy worker.js to Cloudflare
2. ✅ Configure all bindings and environment variables
3. ✅ Initialize database with schema.sql
4. ✅ Test API endpoints with curl
5. ✅ Update frontend .env with API URL
6. 🔄 Implement Stripe integration (if handling payments)
7. 🔄 Add blog creation endpoints for admins
8. 🔄 Implement email verification for new users

## Support

For issues or questions about the Cloudflare Worker:
- Check Cloudflare Dashboard → Logs
- Review error messages in worker responses
- Test endpoints individually with curl first
