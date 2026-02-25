# OKLAHOMABASHI API Endpoint Reference

**Base URL**: `https://oklahomabashi-api.sobuj1.workers.dev`

---

## Authentication Endpoints

### Register User

```
POST /auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123",
  "full_name": "John Doe"
}

Response (201):
{
  "success": true
}

Response (400):
{
  "error": "Email already registered"
}
```

**Validation Rules**:
- Email: Valid email format, ≤255 chars
- Password: ≥8 chars, 1 uppercase, 1 lowercase, 1 number
- Full Name: 2-100 characters

**Rate Limit**: 3 attempts per 5 minutes per IP

---

### Login

```
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123"
}

Response (200):
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "full_name": "John Doe",
    "role": "user"
  }
}

Response (401):
{
  "error": "Invalid credentials"
}
```

**Token Usage**: Include in header for protected endpoints:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI...
```

**Token Expiration**: 24 hours

**Rate Limit**: 5 attempts per minute per IP

---

### Get User Profile

```
GET /auth/profile
Authorization: Bearer {token}

Response (200):
{
  "id": "uuid",
  "email": "user@example.com",
  "full_name": "John Doe",
  "role": "user",
  "created_at": "2024-01-15T10:30:00Z"
}

Response (401):
{
  "error": "Unauthorized"
}
```

**Requires**: Valid JWT token

---

## Events Endpoints

### List All Events

```
GET /events
Query Parameters:
  - status=active (optional, default: active)

Response (200):
[
  {
    "id": "uuid",
    "title": "Pohela Boishakh 2024",
    "description": "Bengali New Year celebration with traditional food and music",
    "category": "cultural",
    "date": 1713052800,
    "location": "Scissortail Park, Oklahoma City, OK",
    "price": 2500,
    "image_url": "https://example.com/image.jpg",
    "capacity": 500,
    "status": "active"
  }
]

Response (400):
{
  "error": "Invalid status parameter"
}
```

**Features**:
- Returns only upcoming events (date >= now)
- Returns only active events (unless admin)
- Ordered by date ascending
- Limited to 100 results

---

### Get Single Event

```
GET /events/{eventId}

Response (200):
{
  "id": "uuid",
  "title": "Pohela Boishakh 2024",
  "description": "...",
  "category": "cultural",
  "date": 1713052800,
  "location": "Scissortail Park, OKC",
  "price": 2500,
  "image_url": "https://...",
  "capacity": 500,
  "status": "active"
}

Response (404):
{
  "error": "Event not found"
}
```

---

## Tickets Endpoints

### Purchase Tickets

```
POST /tickets/purchase
Authorization: Bearer {token}
Content-Type: application/json

{
  "event_id": "uuid",
  "quantity": 1
}

Response (200):
{
  "sessionId": "cs_test_...",
  "url": "https://checkout.stripe.com/pay/cs_test_..."
}

Response (400):
{
  "error": "You already have a ticket for this event"
}

Response (401):
{
  "error": "Unauthorized"
}
```

**Process**:
1. Call endpoint to get Stripe checkout URL
2. Redirect user to URL for payment
3. User completes payment
4. Stripe webhook creates ticket
5. User receives confirmation email

**Note**: Actual ticket is created AFTER payment (via Stripe webhook)

---

### Verify Ticket

```
GET /tickets/verify/{ticketId}

Response (200):
{
  "id": "uuid",
  "event_id": "uuid",
  "status": "valid",
  "qr_code": "https://api.qrserver.com/v1/create-qr-code/?...",
  "created_at": "2024-01-15T10:30:00Z",
  "event_title": "Pohela Boishakh 2024",
  "location": "Scissortail Park, OKC"
}

Response (404):
{
  "error": "Ticket not found"
}
```

**Features**:
- First checks KV cache (<1ms)
- Falls back to database
- Returns ticket + event info
- Cached for 24 hours

---

### Get User's Tickets

```
GET /user/tickets
Authorization: Bearer {token}

Response (200):
[
  {
    "id": "uuid",
    "event_id": "uuid",
    "status": "valid",
    "qr_code": "https://...",
    "created_at": "2024-01-15T10:30:00Z",
    "title": "Pohela Boishakh 2024",
    "date": 1713052800,
    "location": "Scissortail Park, OKC",
    "price": 2500
  }
]

Response (401):
{
  "error": "Unauthorized"
}
```

**Features**:
- Returns only user's tickets
- Ordered by event date (newest first)
- Includes event details
- Shows price paid at time of purchase

---

## Blog Endpoints

### List Blog Posts

```
GET /blog
Query Parameters:
  - limit=50 (optional)
  - category=news (optional)

Response (200):
[
  {
    "id": "uuid",
    "title": "Community Highlights",
    "slug": "community-highlights",
    "excerpt": "This month's community achievements...",
    "category": "news",
    "published_at": "2024-01-15T10:30:00Z",
    "author_id": "uuid"
  }
]
```

**Features**:
- Returns published posts only
- Limited to 50 by default
- Ordered by published date (newest first)
- Public endpoint (no auth required)

---

## Donations Endpoints

### Create Donation

```
POST /donate
Content-Type: application/json

{
  "amount": 25.00,
  "donor_name": "Jane Smith",
  "donor_email": "jane@example.com",
  "message": "Support cultural programming"
}

Response (200):
{
  "sessionId": "cs_test_...",
  "url": "https://checkout.stripe.com/pay/cs_test_..."
}

Response (400):
{
  "error": "Minimum donation is $1.00"
}
```

**Features**:
- Minimum donation: $1.00
- Amount in dollars (converted to cents internally)
- Redirects to Stripe checkout
- Donation recorded after payment
- Tax receipt email sent

---

## Volunteer Endpoints

### Register as Volunteer

```
POST /volunteer
Content-Type: application/json

{
  "email": "volunteer@example.com",
  "full_name": "Volunteer Name",
  "phone": "+1-555-0100",
  "availability": "weekends",
  "interests": "event-setup,hospitality,registration"
}

Response (200):
{
  "success": true
}

Response (400):
{
  "error": "Invalid email format"
}
```

**Feature**:
- Public endpoint
- No authentication required
- Sends confirmation email
- Status starts as "pending"
- Admin reviews and approves

**Availability Options**:
- `weekdays`
- `weekends`
- `flexible`

---

## Admin Endpoints

### Get Dashboard Statistics

```
GET /admin/stats
Authorization: Bearer {admin-token}

Response (200):
{
  "users": 1500,
  "events": 25,
  "tickets": 5000,
  "revenue": 250000
}

Response (403):
{
  "error": "Forbidden"
}
```

**Requires**: Admin role

---

### Create Event

```
POST /admin/events
Authorization: Bearer {admin-token}
Content-Type: application/json

{
  "title": "Pohela Boishakh 2025",
  "description": "Annual Bengali New Year celebration",
  "date": 1744588800,
  "location": "Scissortail Park, Oklahoma City, OK",
  "price": 2500,
  "image_url": "https://example.com/image.jpg",
  "capacity": 500,
  "category": "cultural"
}

Response (201):
{
  "success": true,
  "id": "uuid"
}

Response (403):
{
  "error": "Forbidden"
}
```

**Required Fields**:
- `title` (string)
- `date` (Unix timestamp)
- `location` (string)

**Optional Fields**:
- `description` (string)
- `price` (integer, in cents)
- `image_url` (URL)
- `capacity` (integer)
- `category` (string)

---

### Update Event

```
PUT /admin/events/{eventId}
Authorization: Bearer {admin-token}
Content-Type: application/json

{
  "title": "Updated Title",
  "status": "active"
}

Response (200):
{
  "success": true
}
```

**Features**:
- Partial updates supported
- Only provided fields are updated
- Automatic timestamp update

---

### Delete Event

```
DELETE /admin/events/{eventId}
Authorization: Bearer {admin-token}

Response (200):
{
  "success": true
}
```

**Features**:
- Sets status to "archived" (soft delete)
- Does NOT remove tickets
- Event remains in database
- Can be restored by changing status

---

### Mark Ticket as Used

```
PUT /admin/tickets/{ticketId}
Authorization: Bearer {admin-token}

Response (200):
{
  "success": true,
  "message": "Ticket validated and marked as used"
}

Response (400):
{
  "error": "Ticket already used"
}

Response (404):
{
  "error": "Ticket not found"
}
```

**Features**:
- Records timestamp when marked used
- Prevents double-checking
- Updates cache immediately
- Audit logged

---

### Get All Volunteers

```
GET /admin/volunteers
Authorization: Bearer {admin-token}

Response (200):
[
  {
    "id": "uuid",
    "email": "volunteer@example.com",
    "full_name": "Jane Volunteer",
    "phone": "+1-555-0100",
    "availability": "weekends",
    "interests": "event-setup,hospitality",
    "status": "pending",
    "hours_volunteered": 0,
    "created_at": "2024-01-15T10:30:00Z"
  }
]
```

**Features**:
- Returns all volunteer registrations
- Filter by status in application
- Ordered by creation date

---

### Create Blog Post

```
POST /admin/blog
Authorization: Bearer {admin-token}
Content-Type: application/json

{
  "title": "Event Recap: Pohela Boishakh 2024",
  "content": "# Event Recap\n\nThis was an amazing event...",
  "category": "event_recap"
}

Response (201):
{
  "success": true,
  "id": "uuid"
}
```

**Category Options**:
- `news` - General announcements
- `event_recap` - After-event summaries
- `cultural_guide` - Educational content
- `announcements` - Important notices

---

## Webhook Endpoints

### Stripe Webhook

```
POST /webhooks/stripe
Content-Type: application/json
Stripe-Signature: {signature}

Authorization: Signature verification required

Response (200):
{
  "received": true
}
```

**Events Handled**:
- `checkout.session.completed` - Create tickets, send confirmation
- `charge.refunded` - Mark tickets as refunded
- `charge.dispute.created` - Alert admin

**Processing**:
1. Verifies Stripe signature
2. Creates ticket records
3. Caches in KV
4. Sends confirmation email
5. Triggers audit log

---

## Error Responses

All errors follow this format:

```json
{
  "error": "Human readable error message"
}
```

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request (validation error) |
| 401 | Unauthorized (token invalid/missing) |
| 403 | Forbidden (insufficient permissions) |
| 404 | Not Found |
| 429 | Too Many Requests (rate limited) |
| 500 | Internal Server Error |

---

## Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/auth/register` | 3 | 5 minutes |
| `/auth/login` | 5 | 1 minute |
| `/donate` | 100 | 1 hour |
| All other | Unlimited* | Cloudflare plan |

*Cloudflare Workers free plan: 100,000 requests/day

---

## API Response Times

| Endpoint | Average | p95 |
|----------|---------|-----|
| Public (events, blog) | 50ms | 100ms |
| Auth (login, register) | 100ms | 200ms |
| Database queries | 50-200ms | 500ms |
| Stripe checkout | 500ms | 1s |
| Email sending | Async (bg) | - |

---

## CORS Policy

**Allowed Origins**:
- `https://oklahomabashi.com`
- `https://www.oklahomabashi.com`
- `http://localhost:3000` (dev)

**Allowed Methods**: GET, HEAD, POST, OPTIONS, PUT, DELETE

**Allowed Headers**: Content-Type, Authorization

---

## Testing

### Using cURL

```bash
# Register
curl -X POST https://oklahomabashi-api.sobuj1.workers.dev/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPass123",
    "full_name": "Test User"
  }'

# Login
curl -X POST https://oklahomabashi-api.sobuj1.workers.dev/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPass123"
  }'

# Get events
curl https://oklahomabashi-api.sobuj1.workers.dev/events
```

### Using Postman

1. Import collection: See `API_POSTMAN_COLLECTION.json`
2. Set variable: `token` = JWT from login response
3. Run requests

### Using Frontend API Client

```typescript
import { api } from './services/api';

// Register
await api.register('user@example.com', 'Pass123', 'User Name');

// Login
const response = await api.login('user@example.com', 'Pass123');
console.log(response.user);

// Get events
const events = await api.getEvents();

// Purchase ticket
const session = await api.purchaseTickets('event-id', 1);
window.location.href = session.url; // Redirect to Stripe
```

---

## Support

For API issues:
1. Check error message carefully
2. Verify request format matches documentation
3. Check Worker logs in Cloudflare Dashboard
4. Review error status code above
5. Contact admin: admin@oklahomabashi.com
