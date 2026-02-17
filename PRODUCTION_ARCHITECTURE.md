# OKLAHOMABASHI Production Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Cloudflare Global Network                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────────┐         ┌──────────────────────┐      │
│  │ Cloudflare Pages     │         │ Cloudflare Workers   │      │
│  │ (Next.js Frontend)   │         │ (API Backend)        │      │
│  │                      │         │                      │      │
│  │ https://            │◄───────►│ https://api.         │      │
│  │ oklahomabashi.com   │         │ oklahomabashi.com   │      │
│  └──────────────────────┘         └──────────────────────┘      │
│           │                                    │                 │
│           │                                    │                 │
│           └────────────────┬───────────────────┘                 │
│                            │                                      │
│  ┌──────────────────────────────────────────────────────┐       │
│  │              Cloudflare Services                      │       │
│  ├──────────────────────────────────────────────────────┤       │
│  │ • D1 Database (SQLite)        → user, events, tickets│       │
│  │ • KV Namespace (Cache)        → sessions, rate limits│       │
│  │ • Email API (Resend)          → notifications        │       │
│  │ • Analytics Engine            → usage tracking       │       │
│  └──────────────────────────────────────────────────────┘       │
│                                                                   │
│  ┌──────────────────────────────────────────────────────┐       │
│  │         External Integrations                         │       │
│  ├──────────────────────────────────────────────────────┤       │
│  │ • Stripe                      → payments              │       │
│  │ • QR Code API                 → ticket generation     │       │
│  │ • Resend / SMTP               → email sending         │       │
│  │ • Analytics                   → tracking              │       │
│  └──────────────────────────────────────────────────────┘       │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Technology Stack

### Frontend
- **Framework**: Next.js 14+ (App Router)
- **Styling**: TailwindCSS + CSS Modules
- **Animations**: Framer Motion + GSAP
- **3D Graphics**: React Three Fiber (Three.js)
- **Icons**: Lottie + Heroicons
- **State Management**: React Context + hooks
- **Forms**: React Hook Form + Zod validation
- **HTTP Client**: Fetch API (native)

### Backend
- **Runtime**: Cloudflare Workers
- **Language**: JavaScript (ES2023)
- **Authentication**: JWT (Web Crypto API)
- **Database Driver**: Cloudflare D1 (native)
- **Cache**: Cloudflare KV
- **Payments**: Stripe API

### Database
- **Type**: SQLite via Cloudflare D1
- **Backup**: Automatic (Cloudflare managed)
- **Replication**: Global edge locations
- **Indexes**: Performance optimized

### Deployment
- **Frontend**: Cloudflare Pages (Git-connected or manual)
- **Backend**: Cloudflare Workers (manual deployment)
- **DNS**: Cloudflare DNS
- **SSL/TLS**: Cloudflare managed
- **CDN**: Cloudflare global network

## Data Flow

### User Registration
```
1. User enters details in frontend
2. Frontend validates locally
3. POST /auth/register to worker
4. Worker validates input
5. Worker hashes password (PBKDF2)
6. Worker inserts into D1 users table
7. Worker generates JWT token
8. Worker sends welcome email via Resend
9. Frontend stores JWT in localStorage
10. Frontend redirects to dashboard
```

### Event Purchase Flow
```
1. User clicks "Buy Ticket" on event
2. Frontend verifies user is authenticated
3. Frontend creates Stripe checkout session
4. Worker validates event exists & has capacity
5. User redirected to Stripe hosted checkout
6. User completes payment on Stripe
7. Stripe sends webhook to worker
8. Worker verifies webhook signature
9. Worker creates ticket record in D1
10. Worker generates QR code
11. Worker caches ticket in KV
12. Worker sends ticket email with PDF
13. User gets ticket confirmation
```

### Ticket Verification
```
1. At-door volunteer scans QR code
2. QR contains ticket ID
3. Frontend/mobile calls /tickets/verify/{ticketId}
4. Worker checks KV cache first (instant)
5. If cache miss, checks D1 database
6. Verifies ticket is valid & not used
7. Returns ticket info
8. Admin marks ticket as "used"
```

## Security Architecture

### Authentication
- JWT tokens with 24-hour expiration
- Refresh token rotation (KV stored)
- Password hashing: PBKDF2 (100k iterations)
- Email verification for new accounts

### Authorization
- Role-based access control (RBAC)
  - `user` - Can purchase tickets, donate
  - `volunteer` - Can verify tickets
  - `admin` - Full system access
- Protected endpoints check role on every request
- Safe to deploy on public internet

### Data Protection
- All passwords hashed before storage
- JWT signed with secret (never transmitted)
- Stripe webhook signatures verified
- Rate limiting on auth endpoints
- SQL injection protection via D1 parameterized queries
- CORS restricted to oklahomabashi.com

### Secrets Management
- Database credentials: D1 binding (automatic)
- JWT Secret: Cloudflare encrypted env var
- Stripe Secret: Cloudflare encrypted env var
- Resend API Key: Cloudflare encrypted env var
- Never stored in code or logs

## Performance Optimization

### Frontend
- **Code Splitting**: Automatic via Next.js
- **Image Optimization**: Next.js Image component
- **Lazy Loading**: Dynamic imports for 3D components
- **Caching**: Aggressive Next.js caching
- **Bundle Size**: Minimal ~200KB gzipped
- **Metrics**: Core Web Vitals optimized

### Backend
- **Worker Cold Start**: ~5-50ms edge location
- **D1 Query**: Direct to nearest Cloudflare data center
- **KV Lookup**: <1ms latency
- **Global Replication**: Reads scaled to 600+ servers

### Caching Strategy
```
KV Cache (Fastest):
- Ticket lookups: 24 hours
- Rate limit counters: 60 seconds
- Session data: 7 days
- Static content: 30 days

D1 Cache (Persistent):
- Events: Indexed by date
- Users: Indexed by email
- Tickets: Indexed by user_id, event_id

Browser Cache:
- Static assets: 1 year (with hash)
- API responses: No cache (dynamic)
```

## Scalability

### Expected Capacity
- **Concurrent Users**: 10,000+
- **Requests/Second**: 1,000+ RPS
- **Database Rows**: Millions
- **Event Tickets**: 100,000+ per event
- **Automated Scaling**: Cloudflare handles transparently

### Bottlenecks & Solutions
| Bottleneck | Solution |
|-----------|----------|
| Database Query Slow | Add indexes, denormalize if needed |
| JSON payloads large | Use compression, pagination |
| Image uploads slow | Cloudflare R2 for object storage |
| Email sending delays | Async queue with KV |
| Stripe rate limit | Exponential backoff retry |

## Disaster Recovery

### Backups
- **D1**: Automatic daily backups (Cloudflare managed)
- **Code**: Git repository (GitHub)
- **Configuration**: Cloudflare dashboard exports

### Recovery Time
- Worker deployment: <1 minute
- Pages deployment: <5 minutes
- Database restoration: <30 minutes

## Monitoring & Observability

### Metrics Tracked
- API latency (p50, p95, p99)
- Error rates by endpoint
- Worker cost estimation
- D1 query execution time
- KV cache hit rate
- User geography distribution

### Logging
- Worker error logs: Cloudflare dashboard
- Application logs: Stored in KV
- Access logs: Cloudflare analytics
- Stripe events: Via webhooks

## Maintenance

### Regular Tasks
- Monitor Cloudflare dashboard weekly
- Review D1 storage usage monthly
- Update dependencies quarterly
- Security audit semi-annually
- Load test before major events

### Zero-Downtime Deployment
- Deploy new worker code (automatic rollout)
- Blue-green deployment via URL routing
- Database schema migrations use ALTER TABLE
- No downtime for frontend updates

## Cost Estimation (Monthly)

| Service | Estimated Cost |
|---------|----------------|
| Cloudflare Pages | $20 (custom domain) |
| Cloudflare Workers | $5 (CPU-free tier, $0.50/req overage) |
| D1 Database | $0.75/GB (typically <1GB) |
| KV Namespace | $0.50 (millions of requests included) |
| Domain | $10-15 (WHOIS private) |
| **Total** | **~$36-41/month** |

*Note: Add Stripe processing fees (2.9% + $0.30) and email service costs if using paid plan.*

## Compliance

### GDPR / Privacy
- Explicit consent for data collection
- Right to deletion (anonymize records)
- Data export functionality
- Privacy policy on website
- No third-party trackers

### Security Standards
- OWASP Top 10 compliant
- All endpoints HTTPS-only
- Regular security audits
- Pen test recommended annually
- Vulnerability disclosure policy

### Accessibility
- WCAG 2.1 Level AA compliant
- Keyboard navigation support
- Screen reader friendly
- Color contrast ratios met
- Mobile first responsive design

## Deployment Timeline

| Phase | Timeline | Tasks |
|-------|----------|-------|
| **Preparation** | Week 1 | Setup Cloudflare, purchase domain |
| **Development** | Weeks 1-3 | Build frontend & backend |
| **Testing** | Week 3 | Integration testing, security audit |
| **Staging** | Week 4 | Deploy to staging environment |
| **Production** | Week 4+ | Gradual rollout, monitoring |

## Post-Launch Checklist

- [ ] Monitor error rates for 7 days
- [ ] Verify all payment flows working
- [ ] Test ticket QR scanning on devices
- [ ] Monitor database query performance
- [ ] Check email delivery rates
- [ ] Review security logs
- [ ] Get user feedback
- [ ] Plan Phase 2 features
