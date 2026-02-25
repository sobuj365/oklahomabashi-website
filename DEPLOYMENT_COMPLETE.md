# OKLAHOMABASHI - Complete Deployment Guide

**IMPORTANT**: This guide is for manual deployment through Cloudflare Dashboard. No CLI required.

---

## 📋 Prerequisites

- [ ] Cloudflare account (free or paid)
- [ ] Domain registered and pointing to Cloudflare DNS  
- [ ] Stripe account (for payments)
- [ ] Resend account or SMTP service (for emails)
- [ ] GitHub account (recommended for Pages deployment)
- [ ] Basic knowledge of Cloudflare dashboard

---

## PART 1: CLOUDFLARE WORKERS SETUP

### Step 1.1: Create a Worker

1. Go to **Cloudflare Dashboard** → **Workers and Pages**
2. Click **Create application** → **Create a Worker**
3. Name it: `api-worker`
4. Click **Deploy**

### Step 1.2: Copy Worker Code

1. Open file: `worker-production.js` from the repository
2. Copy **ALL** contents (Ctrl+A, Ctrl+C)
3. Back in Cloudflare Dashboard, click **Edit code**
4. **Delete** all default code
5. **Paste** the entire `worker-production.js` code
6. Click **Save and Deploy**

### Step 1.3: Create D1 Database

1. Go to **Cloudflare Dashboard** → **D1** (left sidebar)
2. Click **Create database**
3. Name: `oklahomabashi-db`
4. Click **Create**
5. You'll see the database in the list. Click on it.
6. Go to **Console** tab
7. Copy **ALL** contents from `schema-production.sql`
8. Paste into the console
9. Click **Execute** or **Run**
10. Wait for results showing "CREATE TABLE" success messages

### Step 1.4: Create KV Namespace

1. Go to **Cloudflare Dashboard** → **KV** (left sidebar)
2. Click **Create namespace**
3. Name: `CACHE` (exact name - case sensitive)
4. Click **Create**

### Step 1.5: Bind D1 to Worker

1. Go to **Workers** → Click your `api-worker`
2. Click **Settings** (top right)
3. Scroll to **Bindings**
4. Click **Add binding**
   - **Variable name**: `DB` (case sensitive)
   - **Resource type**: D1 Database
   - **Database**: Select `oklahomabashi-db`
   - Click **Save**

### Step 1.6: Bind KV to Worker

1. Still in **Settings** → **Bindings**
2. Click **Add binding**
   - **Variable name**: `CACHE` (case sensitive)
   - **Resource type**: KV Namespace
   - **Namespace**: Select `CACHE`
   - Click **Save**

### Step 1.7: Add Environment Variables (Secrets)

1. Still in **Settings** → **Variables**
2. Click **Add variable** for each:

**1st Variable: JWT_SECRET**
- **Variable name**: `JWT_SECRET`
- **Type**: Secret
- **Value**: Generate using one of:
  - Linux: `openssl rand -base64 32`
  - Or use this: `your-secure-random-string-min-32-chars-required`
  - **IMPORTANT: Store this value securely!**
- Click **Save**

**2nd Variable: STRIPE_SECRET_KEY**
- **Variable name**: `STRIPE_SECRET_KEY`
- **Type**: Secret
- **Value**: Get from Stripe Dashboard → Developers → API Keys → Secret Key (starts with `sk_`)
- Click **Save**

**3rd Variable: STRIPE_WEBHOOK_SECRET**
- **Variable name**: `STRIPE_WEBHOOK_SECRET`
- **Type**: Secret
- **Value**: Get from Stripe Dashboard → Developers → Webhooks → Find the endpoint → Signing secret
- Click **Save**

**4th Variable: RESEND_API_KEY**
- **Variable name**: `RESEND_API_KEY`
- **Type**: Secret
- **Value**: Get from Resend.com → API Tokens → Create API Token
- Click **Save**

### Step 1.8: Connect Domain to Worker

1. Go to **Workers** → Click your `api-worker`
2. Click **Triggers** (top navigation)
3. Scroll to **Routes**
4. Click **Add route**
   - **Route**: `api.oklahomabashi.com/*`
   - **Zone**: Select your domain (oklahomabashi.com)
   - **Environment**: Leave as "production"
   - Click **Save**

**Wait 5 minutes for DNS propagation.**

### Step 1.9: Set Up Stripe Webhook

1. Go to **Stripe Dashboard** → **Developers** → **Webhooks**
2. Click **Add endpoint**
3. **Endpoint URL**: `https://oklahomabashi-api.sobuj1.workers.dev/webhooks/stripe`
4. **Events to send**: Select:
   - `checkout.session.completed`
   - `charge.refunded`
   - `charge.dispute.created`
5. Click **Add endpoint**
6. Copy **Signing secret**
7. Add to Cloudflare as `STRIPE_WEBHOOK_SECRET` (see Step 1.7)

---

## PART 2: CLOUDFLARE PAGES SETUP

### Step 2.1: Prepare Frontend for Deployment

The current project uses React + Vite. For production:

1. **Option A: Use Current Setup**
   - Build locally: `npm run build`
   - Deploy output folder (`dist/`) to Pages

2. **Option B: Migrate to Next.js** (recommended)
   - Create Next.js project
   - Copy components from current project
   - Follow Next.js deployment

### Step 2.2: Connect Repository (Git Method)

1. Go to **Cloudflare Dashboard** → **Pages** (left sidebar)
2. Click **Connect to Git**
3. Select **GitHub**
4. Authorize Cloudflare
5. Select your `oklahomabashi-website` repository
6. Click **Begin setup**
7. **Configuration**:
   - **Project name**: `oklahomabashi`
   - **Production branch**: `main`
   - **Framework preset**: 
     - If using Next.js: Select `Next.js`
     - If using Vite: Select `Vite`
   - **Build command**:
     - Next.js: `npm run build`
     - Vite: `npm run build`
   - **Build output directory**:
     - Next.js: `.next`
     - Vite: `dist`
8. Click **Save and Deploy**

### Step 2.3: Manual Deployment (No Git)

If not using GitHub:

1. **Locally** in your project:
   ```bash
   npm install
   npm run build
   ```

2. **In Cloudflare Dashboard**:
   1. Go to **Pages** → **Create application** → **Direct upload**
   2. Drag and drop the output folder:
      - Vite: `dist/` folder
      - Next.js: `.next/` folder
   3. Set **Project name**: `oklahomabashi`
   4. Click **Upload**

### Step 2.4: Connect Custom Domain to Pages

1. In Pages project → **Settings** → **Domain**
2. Click **Add custom domain**
3. **Domain**: `oklahomabashi.com`
4. Wait for verification (auto-verified if DNS points to Cloudflare)
5. Set as root domain

### Step 2.5: Set Production Redirect

1. Still in **Settings**
2. Go to **Builds & deployments** → **Build commands**
3. Ensure correct build command is set
4. Go to **Environment variables**
5. Add:
   - **Name**: `VITE_API_URL`
   - **Value**: `https://oklahomabashi-api.sobuj1.workers.dev`
   - **Environment**: Production

---

## PART 3: CONFIGURE ENVIRONMENT VARIABLES

### Update Frontend `.env` File

1. Create file: `.env.local` in project root
2. Add:
   ```env
   VITE_API_URL=https://oklahomabashi-api.sobuj1.workers.dev
   VITE_JWT_STORAGE_KEY=oklahomabashi_token
   ```

---

## PART 4: VERIFICATION & TESTING

### Test 4.1: Worker Endpoints

**Test 1: Register User**
```bash
curl -X POST https://oklahomabashi-api.sobuj1.workers.dev/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPass123",
    "full_name": "Test User"
  }'
```

Expected response:
```json
{"success": true}
```

**Test 2: Login**
```bash
curl -X POST https://oklahomabashi-api.sobuj1.workers.dev/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPass123"
  }'
```

Expected response:
```json
{
  "token": "eyJhbGc...",
  "user": {
    "id": "uuid",
    "email": "test@example.com",
    "full_name": "Test User",
    "role": "user"
  }
}
```

**Test 3: Get Events (Public)**
```bash
curl https://oklahomabashi-api.sobuj1.workers.dev/events
```

Expected response:
```json
[]
```
(Empty array if no events created)

**Test 4: Get User Profile (Protected)**
```bash
curl https://oklahomabashi-api.sobuj1.workers.dev/auth/profile \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"
```

Expected response:
```json
{
  "id": "uuid",
  "email": "test@example.com",
  "full_name": "Test User",
  "role": "user",
  "created_at": "2024-01-15T10:30:00Z"
}
```

### Test 4.2: Admin Endpoints

1. **Update user role to admin** (via D1 Console):
   ```sql
   UPDATE users SET role = 'admin' WHERE email = 'test@example.com';
   ```

2. **Test Create Event**:
   ```bash
   curl -X POST https://oklahomabashi-api.sobuj1.workers.dev/admin/events \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "title": "Pohela Boishakh 2024",
       "description": "Bengali New Year celebration",
       "date": 1713052800,
       "location": "Scissortail Park, OKC",
       "price": 2500,
       "capacity": 500,
       "image_url": "https://example.com/image.jpg"
     }'
   ```

### Test 4.3: Frontend Connection

1. Go to `https://oklahomabashi.pages.dev`
2. Click **Sign Up**
3. Register with test account
4. Login
5. Should see user dashboard
6. Check browser console for any API errors

### Test 4.4: Check Worker Logs

1. **Cloudflare Dashboard** → **Workers** → Your worker
2. Click **Logs** tab
3. Look for:
   - ✅ Successful requests (200 status)
   - ❌ Any errors (red lines)
   - Check error messages if present

---

## PART 5: POST-DEPLOYMENT CHECKLIST

### Infrastructure
- [ ] Worker deployed and responding
- [ ] D1 database accessible
- [ ] KV namespace working
- [ ] Domain routes configured
- [ ] SSL certificate active (auto via Cloudflare)

### Security
- [ ] All environment variables set
- [ ] JWT_SECRET is unique and strong
- [ ] Stripe keys are secret type
- [ ] CORS configured correctly
- [ ] No hardcoded secrets in code

### Functionality
- [ ] User registration works
- [ ] Login generates valid JWT
- [ ] Protected routes check auth
- [ ] Events can be created (admin)
- [ ] Tickets can be purchased
- [ ] Emails being sent

### Monitoring
- [ ] Worker logs checked for errors
- [ ] Database queries performing well
- [ ] No DDoS/rate limit abuse
- [ ] Error rates < 0.1%

### Data
- [ ] Sample event created
- [ ] Sample user account exists
- [ ] Database backups configured (appears automatic)
- [ ] Audit logs being recorded

---

## TROUBLESHOOTING

### Problem: "Database binding not found"
**Solution**:
1. Go to Worker → Settings → Bindings
2. Verify binding name is exactly `DB`
3. Verify D1 database is selected
4. Click Save again
5. Redeploy worker

### Problem: "CORS error" in browser
**Solution**:
1. Go to Worker
2. Check `ALLOWED_ORIGINS` handling in code
3. Ensure your domain is listed
4. Test with: `curl -H "Origin: https://oklahomabashi.pages.dev" ...`

### Problem: "JWT verification failed"
**Solution**:
1. Check `JWT_SECRET` is identical in worker
2. Regenerate token: logout and login again
3. Verify token format: should start with `eyJ`

### Problem: "Emails not sending"
**Solution**:
1. Check `RESEND_API_KEY` is correct
2. Verify Resend account is active
3. Check D1 email_queue table for failed emails
4. Check Resend dashboard for bounce/spam issues

### Problem: "Payment not working"
**Solution**:
1. Verify `STRIPE_SECRET_KEY` matches Stripe test/live mode
2. Check Stripe webhook is configured
3. Verify webhook secret in Cloudflare
4. Check Stripe logs for failed calls

### Problem: "Worker returns 500 error"
**Solution**:
1. Check Worker logs for error message
2. Verify all bindings are configured
3. Check D1 connection string
4. Validate JSON in request body
5. Restart worker: redeploy code

---

## MAINTENANCE & SCALING

### Weekly Tasks
- [ ] Check Worker error logs
- [ ] Monitor error rate
- [ ] Verify backups working

### Monthly Tasks
- [ ] Review D1 storage usage
- [ ] Check rate limit metrics
- [ ] Update dependencies
- [ ] Test disaster recovery

### Quarterly Tasks
- [ ] Security audit
- [ ] Performance optimization
- [ ] Update documentation
- [ ] Plan new features

### Scaling Considerations
- **Database Growth**: D1 can handle millions of rows
- **Requests**: Worker scales automatically (currently free tier up to CPU-limited)
- **Storage**: First 1GB free, then $0.75/GB

---

## USEFUL CLOUDFLARE LINKS

- [D1 Documentation](https://developers.cloudflare.com/d1/)
- [Workers Documentation](https://developers.cloudflare.com/workers/)
- [Pages Documentation](https://developers.cloudflare.com/pages/)
- [KV Documentation](https://developers.cloudflare.com/workers/runtime-apis/kv/)
- [Stripe Integration Guide](https://stripe.com/docs/stripe-for-platforms)

---

## SUPPORT & NEXT STEPS

1. **Phase 1 (Done)**: Basic deployment
2. **Phase 2**: Add blog CMS
3. **Phase 3**: Advanced analytics
4. **Phase 4**: Mobile app
5. **Phase 5**: Community features

For issues: Check Cloudflare status page and documentation first.
