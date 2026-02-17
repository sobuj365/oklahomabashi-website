# OKLAHOMABASHI Environment Variables & Configuration

## Frontend Environment Variables

Create `.env.local` in your frontend root directory:

```bash
# API Configuration
VITE_API_URL=https://api.oklahomabashi.com

# Feature Flags
VITE_ENABLE_ANALYTICS=true
VITE_ENABLE_DONATIONS=true
VITE_ENABLE_VOLUNTEERS=true
VITE_ENABLE_BLOG=true

# Analytics (Optional)
VITE_GOOGLE_ANALYTICS_ID=GA-XXXXXXXXX-X
VITE_SENTRY_DSN=https://xxxxx@xxxxx.ingest.sentry.io/xxxxx

# Build Info
VITE_APP_VERSION=1.0.0
VITE_BUILD_DATE=$(date -u +'%Y-%m-%dT%H:%M:%SZ')
```

## Backend Environment Variables (Cloudflare Worker)

These must be set in **Cloudflare Dashboard** → **Workers** → **Settings** → **Variables**

### Required Variables (Secrets)

**1. JWT_SECRET** (Type: Secret)
- **Description**: Secret key for signing JWT tokens
- **Minimum Length**: 32 characters
- **Generation**: `openssl rand -base64 32`
- **Example Value**: `fJx9kL2mN4qRsT7vWxYzAbCdEfGhIjKlMnOpQrStUvWx==`
- **⚠️ CRITICAL**: This key signs all authentication tokens. Keep it secure!

**2. STRIPE_SECRET_KEY** (Type: Secret)
- **Description**: Stripe API secret key for payment processing
- **Get From**: Stripe Dashboard → Developers → API Keys → Secret Key
- **Format**: Starts with `sk_live_` or `sk_test_`
- **Example**: `sk_test_51234567890abcdefghijklmnop`
- **⚠️ CRITICAL**: Never expose in client-side code

**3. STRIPE_WEBHOOK_SECRET** (Type: Secret)
- **Description**: Stripe webhook signing secret
- **Get From**: Stripe Dashboard → Developers → Webhooks → [Endpoint] → Signing secret
- **Format**: Starts with `whsec_`
- **Example**: `whsec_test_1234567890abcdefghijklmnop`
- **Usage**: Verifies requests from Stripe belong to your account

**4. RESEND_API_KEY** (Type: Secret)
- **Description**: Resend email service API key
- **Get From**: Resend.com → Settings → API Keys
- **Format**: Starts with `re_`
- **Example**: `re_12345678901234567890123456789012`
- **Alternative**: Use your SMTP service key instead

### Optional Variables (Plaintext)

**ALLOWED_ORIGINS** (Type: Plaintext)
- **Description**: CORS allowed domains (JSON array)
- **Default**: `["https://oklahomabashi.com", "http://localhost:3000"]`
- **Format**:
  ```json
  ["https://oklahomabashi.com", "https://www.oklahomabashi.com"]
  ```

---

## Environment Setup Instructions

### Step 1: Worker Environment Variables

1. **Cloudflare Dashboard** → **Workers & Pages** → Select your worker
2. Click **Settings** (top right)
3. Scroll to **Variables** section
4. For each variable below, click **Add variable**:

#### Add JWT_SECRET
- **Variable name**: `JWT_SECRET`
- **Type**: ✅ **Secret** (checkbox)
- **Value**: Generate unique secret
  ```bash
  # Linux/Mac
  openssl rand -base64 32
  
  # Windows (PowerShell)
  [Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(24))
  ```
- Click **Save**

#### Add STRIPE_SECRET_KEY
- **Variable name**: `STRIPE_SECRET_KEY`
- **Type**: ✅ **Secret**
- **Value**: From Stripe Dashboard
- Click **Save**

#### Add STRIPE_WEBHOOK_SECRET
- **Variable name**: `STRIPE_WEBHOOK_SECRET`
- **Type**: ✅ **Secret**
- **Value**: From Stripe Webhooks settings
- Click **Save**

#### Add RESEND_API_KEY
- **Variable name**: `RESEND_API_KEY`
- **Type**: ✅ **Secret**
- **Value**: From Resend.com
- Click **Save**

---

## Getting API Keys

### Stripe API Keys

1. Go to **Stripe Dashboard** → **Developers** (left sidebar)
2. Click **API Keys**
3. Find "Secret key" section
4. Copy the key (starts with `sk_`)

### Stripe Webhook Secret

1. Still in **Developers** → Click **Webhooks**
2. Click **Add endpoint**
3. **Endpoint URL**: `https://api.oklahomabashi.com/webhooks/stripe`
4. **Events**: Select:
   - `checkout.session.completed`
   - `charge.refunded`
5. Click **Add endpoint**
6. Copy **Signing secret** (starts with `whsec_`)

### Resend API Key

1. Go to **Resend.com** → Sign up / Log in
2. Click **API Keys** (left sidebar)
3. Click **Create API Key**
4. Copy the key (starts with `re_`)

---

## Frontend Configuration

### Next.js Specific

Create `next.config.js`:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'api.oklahomabashi.com',
      },
      {
        protocol: 'https',
        hostname: 'api.qrserver.com', // For QR codes
      },
    ],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;
```

### Vite Specific

Create `vite.config.ts`:

```typescript
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    plugins: [react()],
    server: {
      port: 3000,
      proxy: {
        '/api': {
          target: env.VITE_API_URL || 'https://api.oklahomabashi.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
    build: {
      outDir: 'dist',
      minify: 'terser',
      sourcemap: false,
    },
  };
});
```

---

## Local Development Setup

### 1. Clone Repository

```bash
git clone https://github.com/sobuj365/oklahomabashi-website.git
cd oklahomabashi-website
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Create `.env.local`

```bash
# Copy the example
cp .env.example .env.local

# Edit with your values
nano .env.local
```

Add:
```env
VITE_API_URL=http://localhost:8787
VITE_APP_VERSION=1.0.0-dev
```

### 4. Run Wrangler Locally (Optional)

If you want to test Worker locally:

```bash
# Install Wrangler CLI
npm install -g wrangler

# Create wrangler.toml
cat > wrangler.toml << 'EOF'
name = "api-worker"
type = "service"
account_id = "YOUR_ACCOUNT_ID"
workers_dev = true

[[env.development.d1_databases]]
binding = "DB"
database_name = "oklahomabashi-db"
database_id = "YOUR_DB_ID"

[[kv_namespaces]]
binding = "CACHE"
id = "YOUR_KV_ID"
preview_id = "YOUR_KV_PREVIEW_ID"

[env.development.vars]
JWT_SECRET = "dev-secret-32-chars-minimum-required"
STRIPE_SECRET_KEY = "sk_test_..."
STRIPE_WEBHOOK_SECRET = "whsec_test_..."
RESEND_API_KEY = "re_..."
EOF
```

### 5. Run Frontend

```bash
npm run dev
```

Visit `http://localhost:3000`

---

## Production Checklist

Before deploying to production, verify:

- [ ] **JWT_SECRET** is unique and strong (32+ chars)
- [ ] **STRIPE_SECRET_KEY** uses `sk_live_` (not `sk_test_`)
- [ ] **STRIPE_WEBHOOK_SECRET** matches live endpoint
- [ ] **RESEND_API_KEY** is active and not revoked
- [ ] Domain is correctly set in Cloudflare
- [ ] API URL is `https://api.oklahomabashi.com`
- [ ] Frontend uses environment variables (not hardcoded)
- [ ] No secrets in version control
- [ ] Worker bindings are correctly named
- [ ] D1 database is initialized with schema
- [ ] KV namespace is created and bound

---

## Secrets Security Best Practices

1. **Never commit secrets to Git**
   ```bash
   # Add to .gitignore
   echo ".env.local" >> .gitignore
   echo ".env.*.local" >> .gitignore
   ```

2. **Generate unique values**
   - Don't reuse keys across services
   - Rotate keys quarterly

3. **Use different keys for environments**
   - Development: Use `sk_test_` Stripe keys
   - Production: Use `sk_live_` Stripe keys
   - Different JWT secrets for each

4. **Backup securely**
   - Store JWT_SECRET in password manager
   - Document Stripe account/API key location
   - Keep recovery codes safe

5. **Monitor usage**
   - Check Stripe API key activity
   - Review Resend email logs
   - Monitor Worker logs for errors

---

## Troubleshooting

### "Environment variable not found"
1. Verify variable name matches exactly (case-sensitive)
2. Check it's added to correct Worker (right worker selected?)
3. Redeploy worker after adding variables

### "Cannot read environment variable"
1. Ensure variable is "Secret" type if sensitive
2. Check Cloudflare dashboard → Worker → Settings → Variables
3. Verify binding names match code

### "API calls work locally but not in production"
1. Verify production variables are set
2. Check `VITE_API_URL` points to `https://` (not http)
3. Verify CORS headers allow your domain
4. Check Worker logs for environment variable errors

---

## Reference: What Goes Where

| Variable | Frontend | Worker | Type | Secret? |
|----------|----------|--------|------|---------|
| JWT_SECRET | ❌ | ✅ | String | ✅ Yes |
| STRIPE_SECRET_KEY | ❌ | ✅ | String | ✅ Yes |
| STRIPE_WEBHOOK_SECRET | ❌ | ✅ | String | ✅ Yes |
| RESEND_API_KEY | ❌ | ✅ | String | ✅ Yes |
| API_URL | ✅ (as VITE_API_URL) | ❌ | String | ❌ No |
| APP_VERSION | ✅ (as VITE_APP_VERSION) | ❌ | String | ❌ No |

