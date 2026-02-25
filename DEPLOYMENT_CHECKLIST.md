# 📋 OKLAHOMABASHI DEPLOYMENT CHECKLIST

**Follow this checklist step-by-step. Check off each item as you complete it.**

---

## 🏁 START HERE: What You Need Ready First

Before you begin ANY deployment steps:

- [ ] Domain name registered (example: oklahomabashi.com)
- [ ] Domain has access to change nameservers
- [ ] Gmail or email address ready
- [ ] Credit card ready (for services)
- [ ] 2-3 hours of time blocked
- [ ] This checklist printed or on another device

---

## ✅ DAY 1: Create All Accounts (1-2 hours)

### Morning Session

- [ ] **Create Cloudflare Account**
  - Go to: https://www.cloudflare.com/
  - Click "Sign Up"
  - Verify email
  - **Status**: ✅ Logged into Cloudflare

- [ ] **Add Your Domain to Cloudflare**
  - Click "Add a Site" in Cloudflare
  - Enter domain: `oklahomabashi.com`
  - Choose Free Plan
  - **CRITICAL**: Copy the 2 Cloudflare nameservers
  - **Status**: ⏳ Waiting for DNS to update

### Afternoon Session (After 5-30 min of DNS update)

- [ ] **Change Domain Nameservers**
  - Log into where you bought your domain
  - Find "DNS" or "Nameservers" settings
  - Replace old nameservers with Cloudflare's 2 nameservers
  - Wait for "✅ Great news! Cloudflare is now managing your domain"
  - **Status**: ✅ Domain connected to Cloudflare

- [ ] **Create Stripe Account**
  - Go to: https://dashboard.stripe.com/register
  - Complete signup
  - Choose "Non-profit" organization type
  - Complete verification
  - **Status**: ✅ Stripe ready

- [ ] **Create Resend Account**
  - Go to: https://resend.com
  - Sign up with email
  - Complete organization setup
  - **Status**: ✅ Resend ready

---

## 🔑 DAY 2A: Collect All API Keys (30 minutes)

### Stripe Keys

- [ ] **Get Stripe Keys**
  - Log into Stripe
  - Go: Developers → API Keys
  - Copy **Publishable Key** → Save to text file
  - Copy **Secret Key** → Save to text file
  - Check if using "Test Mode" (for first test) or "Live Mode"
  - **Status**: ✅ Have `pk_` and `sk_` keys

- [ ] **Get Stripe Webhook Secret**
  - Still in Stripe
  - Go: Developers → Webhooks
  - Click "Add Endpoint"
  - URL: `https://oklahomabashi-api.sobuj1.workers.dev/webhooks/stripe`
  - Select events: `checkout.session.completed`, `charge.refunded`
  - Copy **Signing Secret** → Save to text file
  - **Status**: ✅ Have webhook secret (starts with `whsec_`)

### Resend Key

- [ ] **Get Resend API Key**
  - Log into Resend
  - Click "API Keys"
  - Click "Create API Key"
  - Name: `OKLAHOMABASHI Production`
  - Copy key → Save to text file
  - **Status**: ✅ Have Resend key (starts with `re_`)

### Create Your Own JWT Secret

- [ ] **Generate JWT Secret**
  - Go to: https://www.uuidgenerator.net/
  - Click "Generate"
  - Copy the code → Save to text file
  - **Status**: ✅ Have JWT secret

### Your Text File Should Now Have:

```
STRIPE_PUBLISHABLE_KEY: pk_test_xxxxx or pk_live_xxxxx
STRIPE_SECRET_KEY: sk_test_xxxxx or sk_live_xxxxx
STRIPE_WEBHOOK_SECRET: whsec_xxxxx
RESEND_API_KEY: re_xxxxx
JWT_SECRET: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

- [ ] **All 5 keys saved and backed up**
  - **Status**: ⚠️ KEEP THESE SAFE! Don't share!

---

## 🚀 DAY 2B: Deploy Backend (45 minutes)

### Create Cloudflare Worker

- [ ] **Create Worker**
  - Log into Cloudflare
  - Left menu → "Workers & Pages"
  - Click "Create Application"
  - Click "Create a Worker"
  - Name: `oklahomabashi-api`
  - Click "Deploy"
  - **Status**: ✅ Worker created

- [ ] **Copy Backend Code to Worker**
  - Open file: `worker-production.js` (from project)
  - Select ALL code (Ctrl+A)
  - Copy (Ctrl+C)
  - Go to Worker in Cloudflare
  - Click "Code" tab
  - Select all existing code, delete it
  - Paste new code (Ctrl+V)
  - Click "Save and Deploy"
  - **Status**: ✅ Backend code deployed

### Create Database

- [ ] **Create D1 Database**
  - In Cloudflare, left menu → "D1"
  - Click "Create"
  - Name: `oklahomabashi-db`
  - Click "Create"
  - **Status**: ✅ Database created

- [ ] **Create Database Tables**
  - Go to your D1 database → "Console" tab
  - Open file: `schema-production.sql` (from project)
  - Select ALL code, copy it
  - Paste into D1 Console
  - Click "Execute"
  - **Status**: ✅ All tables created (you'll see green checkmarks)

### Create Cache

- [ ] **Create KV Namespace**
  - Left menu → "Workers & Pages" → "KV"
  - Click "Create namespace"
  - Name: `CACHE`
  - Click "Add namespace"
  - **Status**: ✅ Cache created

### Connect Everything

- [ ] **Bind Database to Worker**
  - Go to Worker: `oklahomabashi-api`
  - Click "Settings" → "Bindings"
  - Click "Add Binding"
  - Variable name: `DB`
  - Type: `D1 Database`
  - Database: `oklahomabashi-db`
  - Click "Save"
  - **Status**: ✅ Database connected

- [ ] **Bind Cache to Worker**
  - Click "Add Binding"
  - Variable name: `CACHE`
  - Type: `KV Namespace`
  - Namespace: `CACHE`
  - Click "Save"
  - **Status**: ✅ Cache connected

### Add Secret Keys

- [ ] **Add JWT Secret**
  - Still in Worker Settings → Bindings
  - Find "Environment Variables" or "Secrets" section
  - Click "Add Variable"
  - Name: `JWT_SECRET`
  - Value: (paste from your text file)
  - Click "Save"
  - **Status**: ✅ JWT secret added

- [ ] **Add Stripe Secret Key**
  - Click "Add Variable"
  - Name: `STRIPE_SECRET_KEY`
  - Value: (paste your `sk_` key from text file)
  - Click "Save"
  - **Status**: ✅ Stripe key added

- [ ] **Add Stripe Webhook Secret**
  - Click "Add Variable"
  - Name: `STRIPE_WEBHOOK_SECRET`
  - Value: (paste your `whsec_` from text file)
  - Click "Save"
  - **Status**: ✅ Webhook secret added

- [ ] **Add Resend API Key**
  - Click "Add Variable"
  - Name: `RESEND_API_KEY`
  - Value: (paste your `re_` key from text file)
  - Click "Save"
  - **Status**: ✅ Resend key added

### Create API Route

- [ ] **Create Route for API**
  - In Cloudflare, click your domain: `oklahomabashi.com`
  - Left menu → "Workers & Pages" → "Routes"
  - Click "Create Route"
  - Route: `api.oklahomabashi.com/*`
  - Worker: select `oklahomabashi-api`
  - Zone: select `oklahomabashi.com`
  - Click "Save"
  - **Status**: ✅ API route created

- [ ] **Test API is Working**
  - Open browser, go to: `https://oklahomabashi-api.sobuj1.workers.dev/events`
  - You should see: `[]` or some JSON
  - **Status**: ✅ Backend working!

---

## 📱 DAY 3A: Deploy Frontend (45 minutes)

### Prepare Code on GitHub

- [ ] **Create GitHub Account**
  - Go to: https://github.com/signup
  - Create account with your email
  - Choose Free plan
  - **Status**: ✅ GitHub account ready

- [ ] **Create GitHub Repository**
  - Go to: https://github.com/new
  - Name: `oklahomabashi-website`
  - Description: `OKLAHOMABASHI Website`
  - Choose "Public"
  - Click "Create repository"
  - **Status**: ✅ Repository created (empty)

- [ ] **Upload Code to GitHub**
  - In your repository, click "Add file" → "Upload files"
  - Find your `oklahomabashi-website` folder
  - Select ALL files in that folder
  - Drag them to GitHub upload area (or click to browse)
  - Add message: "Initial commit"
  - Click "Commit changes"
  - **Status**: ✅ Code uploaded to GitHub

✨ **If you get an error with too many files:**
- Zip your project folder first
- Upload the .zip file instead
- GitHub will automatically extract it

### Connect GitHub to Cloudflare Pages

- [ ] **Create Pages Project**
  - In Cloudflare, left menu → "Workers & Pages"
  - Click "Pages" tab
  - Click "Create"
  - Select "Connect to Git"
  - Click "GitHub"
  - Authorize Cloudflare (click "Authorize Cloudflare")
  - Select your `oklahomabashi-website` repository
  - Click "Begin setup"
  - **Status**: ✅ Repository connected

- [ ] **Configure Build Settings**
  - Framework: Select "Vite" (or "Next.js" if using that)
  - Build command: `npm run build`
  - Build output: `dist/` (or `.next/` for Next.js)
  - Root directory: `/`
  - **Status**: ✅ Build settings configured

- [ ] **Add Environment Variable**
  - In build settings, click "Add Variable"
  - Name: `VITE_API_URL`
  - Value: `https://oklahomabashi-api.sobuj1.workers.dev`
  - Click "Save"
  - **Status**: ✅ Environment variable added

- [ ] **Deploy**
  - Click "Save and Deploy"
  - Wait 2-5 minutes for Cloudflare to build
  - You should see: "✅ Deployment successful"
  - **Status**: ✅ Website built and deployed

### Connect Domain to Website

- [ ] **Add Custom Domain**
  - Go to Pages → Your site → "Settings"
  - Scroll to "Domains"
  - Click "Add Domain"
  - Type: `oklahomabashi.com`
  - Click "Add Domain"
  - **Status**: ✅ Domain connected

- [ ] **Verify Website Loads**
  - Open browser
  - Go to: `https://oklahomabashi.com`
  - You should see your website
  - **Status**: ✅ Website live!

---

## ✅ DAY 3B: Test Everything (1 hour)

### Test Basic Functionality

- [ ] **Test Website Loads**
  - Go to: `https://oklahomabashi.com`
  - Should load in under 3 seconds
  - Should have green 🔒 lock icon
  - **Status**: ✅ Website accessible

- [ ] **Test API Works**
  - Go to: `https://oklahomabashi-api.sobuj1.workers.dev/events`
  - Should see JSON response (like: `[]`)
  - **Status**: ✅ API accessible

### Test User Registration

- [ ] **Register Test User**
  - Go to website
  - Click "Sign Up"
  - Email: `yourname+test1@gmail.com`
  - Password: `TestPassword123!`
  - Name: `Test User`
  - Click "Register"
  - **Status**: ? See below

- [ ] **Verify Registration**
  - Check email inbox
  - Should receive verification email from Resend
  - Go back to website
  - Should be logged in
  - **Status**: ✅ Registration works!

### Create Admin Account

- [ ] **Access Database Console**
  - Go to Cloudflare → D1
  - Click `oklahomabashi-db`
  - Click "Console"
  - **Status**: ✅ Console open

- [ ] **Make User an Admin**
  - Copy this command:
  ```sql
  UPDATE users SET role = 'admin' WHERE email = 'yourname+test1@gmail.com';
  ```
  - Paste into console
  - Click "Execute"
  - **Status**: ✅ User is now admin

- [ ] **Test Admin Dashboard**
  - Log out and log back in as that user
  - You should see "Admin Dashboard" link
  - Click it
  - Should see dashboard with stats
  - **Status**: ✅ Admin dashboard works!

### Test Creating Event

- [ ] **Create Test Event**
  - In Admin Dashboard
  - Click "Create Event"
  - Name: `Test Event - Delete Me`
  - Date: Pick next Saturday
  - Price: `25.00`
  - Capacity: `50`
  - Click "Create"
  - **Status**: ✅ Event created!

### Test Buying Ticket (Test Mode)

- [ ] **Ensure Stripe is in Test Mode**
  - Go: https://dashboard.stripe.com
  - Check for "Test Mode" toggle at top
  - Should show "Test Mode" (blue button)
  - **Status**: ✅ Using test mode

- [ ] **Buy Ticket**
  - Log out of admin account
  - Log in as test user (or create new test user)
  - Go to Events
  - Click "Get Tickets" on test event
  - Choose quantity: `1`
  - Click "Buy Now"
  - **Status**: Redirected to Stripe

- [ ] **Complete Test Payment**
  - On Stripe checkout page:
    - Card: `4242 4242 4242 4242`
    - Expiration: `12/34` 
    - CVC: `123`
    - Name: `Test User`
  - Click "Pay"
  - **Status**: ? Try payment

- [ ] **Verify Payment Processed**
  - You should see ticket page with QR code
  - Email should arrive with ticket
  - In admin dashboard, ticket should show
  - **Status**: ✅ Full payment flow works!

---

## 🎯 DAY 4: Go Live (1 hour)

### Switch to Live Mode

- [ ] **Switch Stripe to Live**
  - Go: https://dashboard.stripe.com
  - Click "Test Mode" toggle
  - Switch to "Live Mode"
  - **Status**: ⚠️ Real money mode activated

- [ ] **Get Live Stripe Keys**
  - Go: Developers → API Keys
  - Ensure "Live" mode showing
  - Copy new `pk_live_` key
  - Copy new `sk_live_` key
  - Copy live webhook secret
  - Update in text file
  - **Status**: ✅ Live keys obtained

### Update Cloudflare with Live Keys

- [ ] **Update Worker Secrets**
  - Go to Cloudflare Worker: `oklahomabashi-api`
  - Click Settings → Bindings
  - Update `STRIPE_SECRET_KEY` with live `sk_live_` key
  - Update `STRIPE_WEBHOOK_SECRET` with live webhook secret
  - Click "Deploy"
  - **Status**: ✅ Worker updated with live keys

- [ ] **Test Live Payment**
  - Log in to your website
  - Buy a ticket
  - Use REAL credit card
  - Complete payment
  - Check Stripe dashboard - should show transaction
  - **Status**: ✅ Live payments working!

### Final Verification

- [ ] **Full System Check**
  - [ ] Website loads at `https://oklahomabashi.com`
  - [ ] Can register users
  - [ ] Can login as admin
  - [ ] Can create events
  - [ ] Can buy tickets with real Stripe
  - [ ] Emails arriving
  - [ ] QR codes displaying
  - [ ] No error messages in Worker logs
  - **Status**: ✅ READY FOR LAUNCH!

---

## 🚀 DAY 5: Launch!

### Prepare for Public

- [ ] **Create Initial Events**
  - Log in as admin
  - Create 2-3 real events
  - Add descriptions and images
  - Set correct dates and prices
  - **Status**: ✅ Events visible

- [ ] **Test as Customer**
  - Log out
  - Browse events as a new user
  - Try buying a ticket
  - Complete full flow
  - **Status**: ✅ Everything works

- [ ] **Backup Keys**
  - Save your API keys somewhere safe
  - Store admin password securely
  - **Status**: ✅ Backup complete

### Tell the World

- [ ] **Share Website**
  - Tell your community about the site
  - Share on social media
  - Send email to your mailing list
  - **Status**: 🎉 LAUNCHED!

---

## 📞 Troubleshooting Section

### If something doesn't work...

**Website won't load:**
- [ ] Check domain nameservers (should be Cloudflare's)
- [ ] Wait 30 minutes for DNS update
- [ ] Check: https://dns.google/

**API returns error:**
- [ ] Check all 4 secrets in Worker settings
- [ ] Check Worker logs (Workers → your worker → Logs tab)
- [ ] Verify spelling and no extra spaces

**Payment fails:**
- [ ] Ensure Stripe is in Test Mode (for testing)
- [ ] Use test card: `4242 4242 4242 4242`
- [ ] Check Stripe webhook logs

**Email not arriving:**
- [ ] Check spam folder
- [ ] Verify RESEND_API_KEY is correct
- [ ] Redeploy Worker after updating key

---

## 📊 Final Checklist (Check Every Box!)

By the time you finish:

- [ ] Website live at `oklahomabashi.com` ✅
- [ ] API working at `oklahomabashi-api.sobuj1.workers.dev` ✅
- [ ] Database created with all tables ✅
- [ ] Admin account created ✅
- [ ] Test events created ✅
- [ ] Payment system working with real Stripe ✅
- [ ] Emails sending correctly ✅
- [ ] QR codes generating ✅
- [ ] All 5 API keys stored safely ✅
- [ ] Admin trained on how to use dashboard ✅

---

## 🎉 Congratulations!

**Your OKLAHOMABASHI website is LIVE!**

You can now:
- ✅ Accept event ticket payments
- ✅ Manage events and volunteers
- ✅ Send automated confirmations
- ✅ Track donations
- ✅ Serve your nonprofit community

---

**Print this checklist and check each box as you go!**

**If you get stuck on any step → Check BEGINNER_DEPLOYMENT_GUIDE.md for detailed instructions**
