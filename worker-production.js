/**
 * OKLAHOMABASHI - Complete Production Cloudflare Worker
 * 
 * REQUIRED CLOUDFLARE BINDINGS:
 * • DB (D1 Database binding)
 * • CACHE (KV Namespace binding)
 * 
 * REQUIRED ENVIRONMENT VARIABLES (Cloudflare Secrets):
 * • JWT_SECRET (string) - Sign/verify tokens
 * • STRIPE_SECRET_KEY (string) - Stripe API key
 * • STRIPE_WEBHOOK_SECRET (string) - Webhook signature verification
 * • RESEND_API_KEY (string) - Email service API key
 * • ALLOWED_ORIGINS (JSON string) - CORS allowed domains
 */

const ALLOWED_ORIGINS_DEFAULT = ['https://oklahomabashi.com', 'https://oklahomabashi.pages.dev', 'http://localhost:3000'];

const parseAllowedOrigins = (env) => {
  const raw = env?.ALLOWED_ORIGINS;
  if (!raw) return ALLOWED_ORIGINS_DEFAULT;

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : ALLOWED_ORIGINS_DEFAULT;
  } catch {
    return raw.split(',').map((entry) => entry.trim()).filter(Boolean);
  }
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const generateUUID = () => crypto.randomUUID();

const getCorsHeaders = (origin, env) => {
  const allowedOrigins = parseAllowedOrigins(env);
  const isWildcard = allowedOrigins.includes('*');
  const isAllowed = isWildcard || (origin && allowedOrigins.includes(origin));
  const allowOrigin = isAllowed ? (isWildcard ? '*' : origin) : ALLOWED_ORIGINS_DEFAULT[0];

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS, PUT, DELETE',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
};

// ============================================================================
// PASSWORD HASHING (PBKDF2)
// ============================================================================

async function hashPassword(password, salt = null) {
  if (!salt) {
    const saltBuffer = crypto.getRandomValues(new Uint8Array(16));
    salt = Array.from(saltBuffer).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  const passwordBuffer = new TextEncoder().encode(password);
  const saltBuffer = new Uint8Array(salt.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
  
  const key = await crypto.subtle.importKey('raw', passwordBuffer, { name: 'PBKDF2' }, false, ['deriveBits']);
  
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations: 100000,
      hash: 'SHA-256',
    },
    key,
    256
  );
  
  const hashArray = Array.from(new Uint8Array(derivedBits));
  const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return `${salt}:${hash}`;
}

async function verifyPassword(password, storedHash) {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [salt] = storedHash.split(':');
  const newHash = await hashPassword(password, salt);
  return newHash === storedHash;
}

// ============================================================================
// JWT FUNCTIONS
// ============================================================================

async function signJWT(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  
  const encodedHeader = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const encodedPayload = btoa(JSON.stringify({
    ...payload,
    iat: now,
    exp: now + 86400, // 24 hours
  })).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  
  const signatureInput = `${encodedHeader}.${encodedPayload}`;
  
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signatureInput));
  const encodedSignature = btoa(String.fromCharCode.apply(null, new Uint8Array(signature)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  
  return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
}

async function verifyJWT(request, secret) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  
  const token = authHeader.split(' ')[1];
  
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const [header, payload, signature] = parts;
    
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    
    const standardSignature = (signature + '==').replace(/-/g, '+').replace(/_/g, '/');
    const signatureBin = Uint8Array.from(atob(standardSignature), c => c.charCodeAt(0));
    
    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      signatureBin,
      new TextEncoder().encode(`${header}.${payload}`)
    );
    
    if (!isValid) return null;
    
    const standardPayload = (payload + '==').replace(/-/g, '+').replace(/_/g, '/');
    const decodedPayload = JSON.parse(atob(standardPayload));
    
    const now = Math.floor(Date.now() / 1000);
    if (decodedPayload.exp < now) return null;
    
    return decodedPayload;
  } catch (e) {
    console.error('JWT error:', e);
    return null;
  }
}

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

const validateEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email) && email.length <= 255;
};

const validatePassword = (password) => password.length >= 8 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /[0-9]/.test(password);

const validateFullName = (name) => typeof name === 'string' && name.trim().length >= 2 && name.trim().length <= 100;

// ============================================================================
// RATE LIMITING
// ============================================================================

async function checkRateLimit(cache, key, limit = 5, window = 60) {
  const rateLimitKey = `ratelimit:${key}`;
  const current = await cache.get(rateLimitKey);
  const count = current ? parseInt(current) : 0;
  
  if (count >= limit) return false;
  
  await cache.put(rateLimitKey, String(count + 1), { expirationTtl: window });
  return true;
}

// ============================================================================
// EMAIL SENDING
// ============================================================================

async function sendEmail(to, subject, html, resendApiKey) {
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'events@oklahomabashi.com',
        to,
        subject,
        html,
      }),
    });
    
    if (!response.ok) {
      console.error('Email send failed:', await response.text());
      return false;
    }
    
    return true;
  } catch (e) {
    console.error('Email error:', e);
    return false;
  }
}

// ============================================================================
// QR CODE GENERATION (Data URLs)
// ============================================================================

function generateQRCodeDataUrl(text) {
  // Using qr-server.com for QR generation (free, no API key needed)
  return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(text)}`;
}

// ============================================================================
// STRIPE WEBHOOK VERIFICATION
// ============================================================================

async function verifyStripeWebhook(request, secret) {
  const signature = request.headers.get('stripe-signature');
  if (!signature) return null;

  try {
    const body = await request.text();
    const signatureParts = signature.split(',').reduce((acc, part) => {
      const [key, value] = part.split('=');
      acc[key.trim()] = value;
      return acc;
    }, {});

    const timestamp = signatureParts.t;
    const signedContent = `${timestamp}.${body}`;
    
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const expectedSig = await crypto.subtle.sign(
      'HMAC',
      key,
      new TextEncoder().encode(signedContent)
    );

    const expectedSigHex = Array.from(new Uint8Array(expectedSig))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    if (signatureParts.v1 !== expectedSigHex) return null;

    return JSON.parse(body);
  } catch (e) {
    console.error('Webhook verification failed:', e);
    return null;
  }
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.protocol === 'http:') {
      url.protocol = 'https:';
      return Response.redirect(url.toString(), 301);
    }

    const origin = request.headers.get('Origin') || 'https://oklahomabashi.com';
    const corsHeaders = getCorsHeaders(origin, env);
    
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const path = url.pathname;

    try {
      // ====================================================================
      // PUBLIC ROUTES
      // ====================================================================

      // GET /events - List all upcoming events
      if (path === '/events' && request.method === 'GET') {
        const now = Math.floor(Date.now() / 1000);
        const { results } = await env.DB.prepare(
          'SELECT * FROM events WHERE date >= ? AND status = ? ORDER BY date ASC LIMIT 100'
        ).bind(now, 'active').all();
        
        return Response.json(results || [], { headers: corsHeaders });
      }

      // GET /events/:id - Get single event
      if (path.match(/^\/events\/[^/]+$/) && request.method === 'GET') {
        const id = path.split('/').pop();
        const event = await env.DB.prepare('SELECT * FROM events WHERE id = ?').bind(id).first();
        
        if (!event) {
          return Response.json({ error: 'Event not found' }, { status: 404, headers: corsHeaders });
        }
        
        return Response.json(event, { headers: corsHeaders });
      }

      // GET /blog - List blog posts
      if (path === '/blog' && request.method === 'GET') {
        const { results } = await env.DB.prepare(
          'SELECT * FROM blog_posts WHERE published = 1 ORDER BY published_at DESC LIMIT 50'
        ).all();
        
        return Response.json(results || [], { headers: corsHeaders });
      }

      // ====================================================================
      // AUTH ROUTES
      // ====================================================================

      // POST /auth/register
      if (path === '/auth/register' && request.method === 'POST') {
        const ip = request.headers.get('cf-connecting-ip') || 'unknown';
        const canRegister = await checkRateLimit(env.CACHE, `reg:${ip}`, 3, 300);
        
        if (!canRegister) {
          return Response.json(
            { error: 'Too many registration attempts. Try again later.' },
            { status: 429, headers: corsHeaders }
          );
        }

        let body;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: 'Invalid JSON' }, { status: 400, headers: corsHeaders });
        }

        const { email, password, full_name } = body;

        if (!validateEmail(email)) {
          return Response.json({ error: 'Invalid email' }, { status: 400, headers: corsHeaders });
        }
        if (!validatePassword(password)) {
          return Response.json({ error: 'Password must be 8+ chars with uppercase, lowercase, number' }, { status: 400, headers: corsHeaders });
        }
        if (!validateFullName(full_name)) {
          return Response.json({ error: 'Name must be 2-100 characters' }, { status: 400, headers: corsHeaders });
        }

        const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
        if (existing) {
          return Response.json({ error: 'Email already registered' }, { status: 400, headers: corsHeaders });
        }

        const id = generateUUID();
        const hash = await hashPassword(password);
        
        await env.DB.prepare(
          'INSERT INTO users (id, email, password_hash, full_name, role, created_at) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind(id, email, hash, full_name.trim(), 'user', new Date().toISOString()).run();

        // Send confirmation email
        await sendEmail(
          email,
          'Welcome to OKLAHOMABASHI',
          `<h1>Welcome, ${full_name}!</h1><p>Your account has been created. Log in to explore cultural events and ticket purchasing.</p>`,
          env.RESEND_API_KEY
        );

        return Response.json({ success: true }, { headers: corsHeaders });
      }

      // POST /auth/login
      if (path === '/auth/login' && request.method === 'POST') {
        const ip = request.headers.get('cf-connecting-ip') || 'unknown';
        const canLogin = await checkRateLimit(env.CACHE, `login:${ip}`, 5, 60);
        
        if (!canLogin) {
          return Response.json({ error: 'Too many login attempts' }, { status: 429, headers: corsHeaders });
        }

        let body;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: 'Invalid JSON' }, { status: 400, headers: corsHeaders });
        }

        const { email, password } = body;

        const user = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();

        if (!user || !await verifyPassword(password, user.password_hash)) {
          return Response.json({ error: 'Invalid credentials' }, { status: 401, headers: corsHeaders });
        }

        const token = await signJWT(
          { userId: user.id, email: user.email, role: user.role },
          env.JWT_SECRET
        );

        return Response.json({
          token,
          user: {
            id: user.id,
            email: user.email,
            full_name: user.full_name,
            role: user.role,
          },
        }, { headers: corsHeaders });
      }

      // GET /auth/profile
      if (path === '/auth/profile' && request.method === 'GET') {
        const user = await verifyJWT(request, env.JWT_SECRET);
        if (!user) {
          return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
        }

        const userRecord = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(user.userId).first();
        
        if (!userRecord) {
          return Response.json({ error: 'User not found' }, { status: 404, headers: corsHeaders });
        }

        return Response.json({
          id: userRecord.id,
          email: userRecord.email,
          full_name: userRecord.full_name,
          role: userRecord.role,
          created_at: userRecord.created_at,
        }, { headers: corsHeaders });
      }

      // GET /user/profile
      if (path === '/user/profile' && request.method === 'GET') {
        const user = await verifyJWT(request, env.JWT_SECRET);
        if (!user) {
          return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
        }

        const userRecord = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(user.userId).first();

        if (!userRecord) {
          return Response.json({ error: 'User not found' }, { status: 404, headers: corsHeaders });
        }

        return Response.json({
          id: userRecord.id,
          email: userRecord.email,
          full_name: userRecord.full_name,
          role: userRecord.role,
          phone: userRecord.phone,
          billing_address1: userRecord.billing_address1,
          billing_address2: userRecord.billing_address2,
          billing_city: userRecord.billing_city,
          billing_state: userRecord.billing_state,
          billing_zip: userRecord.billing_zip,
          billing_country: userRecord.billing_country,
          created_at: userRecord.created_at,
        }, { headers: corsHeaders });
      }

      // PUT /user/profile
      if (path === '/user/profile' && request.method === 'PUT') {
        const user = await verifyJWT(request, env.JWT_SECRET);
        if (!user) {
          return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
        }

        let body;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: 'Invalid JSON' }, { status: 400, headers: corsHeaders });
        }

        const {
          full_name,
          email,
          phone,
          billing_address1,
          billing_address2,
          billing_city,
          billing_state,
          billing_zip,
          billing_country
        } = body;

        if (email && !validateEmail(email)) {
          return Response.json({ error: 'Invalid email' }, { status: 400, headers: corsHeaders });
        }

        if (full_name && !validateFullName(full_name)) {
          return Response.json({ error: 'Invalid full name' }, { status: 400, headers: corsHeaders });
        }

        const fields = {
          full_name: full_name ?? null,
          email: email ?? null,
          phone: phone ?? null,
          billing_address1: billing_address1 ?? null,
          billing_address2: billing_address2 ?? null,
          billing_city: billing_city ?? null,
          billing_state: billing_state ?? null,
          billing_zip: billing_zip ?? null,
          billing_country: billing_country ?? null
        };

        const hasUpdate = Object.values(fields).some((value) => value !== null);
        if (!hasUpdate) {
          return Response.json({ error: 'No fields provided' }, { status: 400, headers: corsHeaders });
        }

        try {
          await env.DB.prepare(
            `UPDATE users SET
              full_name = COALESCE(?, full_name),
              email = COALESCE(?, email),
              phone = COALESCE(?, phone),
              billing_address1 = COALESCE(?, billing_address1),
              billing_address2 = COALESCE(?, billing_address2),
              billing_city = COALESCE(?, billing_city),
              billing_state = COALESCE(?, billing_state),
              billing_zip = COALESCE(?, billing_zip),
              billing_country = COALESCE(?, billing_country),
              updated_at = ?
            WHERE id = ?`
          ).bind(
            fields.full_name,
            fields.email,
            fields.phone,
            fields.billing_address1,
            fields.billing_address2,
            fields.billing_city,
            fields.billing_state,
            fields.billing_zip,
            fields.billing_country,
            new Date().toISOString(),
            user.userId
          ).run();
        } catch (err) {
          const message = err?.message || 'Update failed';
          if (message.includes('UNIQUE')) {
            return Response.json({ error: 'Email already in use' }, { status: 409, headers: corsHeaders });
          }
          throw err;
        }

        return Response.json({ success: true }, { headers: corsHeaders });
      }

      // ====================================================================
      // TICKET ROUTES
      // ====================================================================

      // POST /tickets/purchase
      if (path === '/tickets/purchase' && request.method === 'POST') {
        const user = await verifyJWT(request, env.JWT_SECRET);
        if (!user) {
          return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
        }

        let body;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: 'Invalid JSON' }, { status: 400, headers: corsHeaders });
        }

        const { event_id, quantity = 1 } = body;
        const parsedQuantity = Number(quantity);

        if (!Number.isInteger(parsedQuantity) || parsedQuantity < 1 || parsedQuantity > 20) {
          return Response.json({ error: 'Invalid ticket quantity' }, { status: 400, headers: corsHeaders });
        }

        const event = await env.DB.prepare('SELECT * FROM events WHERE id = ?').bind(event_id).first();
        if (!event) {
          return Response.json({ error: 'Event not found' }, { status: 404, headers: corsHeaders });
        }

        if (event.status && event.status !== 'active') {
          return Response.json({ error: 'Event is not available' }, { status: 400, headers: corsHeaders });
        }

        // Check if already has ticket
        const existing = await env.DB.prepare(
          'SELECT id FROM tickets WHERE user_id = ? AND event_id = ?'
        ).bind(user.userId, event_id).first();
        
        if (existing) {
          return Response.json({ error: 'You already have a ticket for this event' }, { status: 400, headers: corsHeaders });
        }

        // Validate capacity
        if (event.capacity) {
          const { results } = await env.DB.prepare(
            'SELECT COUNT(*) as count FROM tickets WHERE event_id = ?'
          ).bind(event_id).all();
          const ticketCount = results?.[0]?.count || 0;

          if (ticketCount + parsedQuantity > event.capacity) {
            return Response.json({ error: 'Event is at capacity' }, { status: 400, headers: corsHeaders });
          }
        }

        const unitAmount = Math.max(0, Math.round(event.price || 0));

        // Create Stripe payment intent
        const stripeResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            'payment_method_types[]': 'card',
            'line_items[0][price_data][currency]': 'usd',
            'line_items[0][price_data][unit_amount]': String(unitAmount),
            'line_items[0][price_data][product_data][name]': event.title,
            'line_items[0][quantity]': String(parsedQuantity),
            'mode': 'payment',
            'success_url': `https://oklahomabashi.com/ticket-success?session_id={CHECKOUT_SESSION_ID}`,
            'cancel_url': `https://oklahomabashi.com/events/${event_id}`,
            'client_reference_id': `${user.userId}:${event_id}:${parsedQuantity}`,
            'customer_email': user.email,
          }),
        });

        if (!stripeResponse.ok) {
          return Response.json({ error: 'Payment failed' }, { status: 500, headers: corsHeaders });
        }

        const session = await stripeResponse.json();

        return Response.json({
          sessionId: session.id,
          url: session.url,
        }, { headers: corsHeaders });
      }

      // GET /tickets/verify/:ticketId
      if (path.match(/^\/tickets\/verify\/[^/]+$/) && request.method === 'GET') {
        const ticketId = path.split('/').pop();

        // Try KV cache first
        let ticket = await env.CACHE.get(`ticket:${ticketId}`);
        
        if (ticket) {
          return Response.json(JSON.parse(ticket), { headers: corsHeaders });
        }

        // Fall back to database
        ticket = await env.DB.prepare(
          'SELECT t.*, e.title, e.location FROM tickets t JOIN events e ON t.event_id = e.id WHERE t.id = ?'
        ).bind(ticketId).first();

        if (!ticket) {
          return Response.json({ error: 'Ticket not found' }, { status: 404, headers: corsHeaders });
        }

        // Cache it
        await env.CACHE.put(`ticket:${ticketId}`, JSON.stringify(ticket), { expirationTtl: 86400 });

        return Response.json(ticket, { headers: corsHeaders });
      }

      // GET /user/tickets
      if (path === '/user/tickets' && request.method === 'GET') {
        const user = await verifyJWT(request, env.JWT_SECRET);
        if (!user) {
          return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
        }

        const { results } = await env.DB.prepare(`
          SELECT t.id, t.event_id, t.status, t.qr_code, t.created_at,
                 e.title, e.date, e.location, e.price
          FROM tickets t
          JOIN events e ON t.event_id = e.id
          WHERE t.user_id = ?
          ORDER BY e.date DESC
        `).bind(user.userId).all();

        return Response.json(results || [], { headers: corsHeaders });
      }

      // ====================================================================
      // DONATIONS
      // ====================================================================

      // POST /donate
      if (path === '/donate' && request.method === 'POST') {
        let body;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: 'Invalid JSON' }, { status: 400, headers: corsHeaders });
        }

        const { amount, donor_email, donor_name, message } = body;

        if (!amount || amount < 100) {
          return Response.json({ error: 'Minimum donation is $1.00' }, { status: 400, headers: corsHeaders });
        }

        // Create Stripe payment for donation
        const stripeResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            'payment_method_types[]': 'card',
            'line_items[0][price_data][currency]': 'usd',
            'line_items[0][price_data][unit_amount]': String(amount),
            'line_items[0][price_data][product_data][name]': 'Donation to OKLAHOMABASHI',
            'line_items[0][quantity]': '1',
            'mode': 'payment',
            'success_url': `https://oklahomabashi.com/donate-success?amount=${amount}`,
            'cancel_url': `https://oklahomabashi.com/donate`,
            'customer_email': donor_email,
          }),
        });

        if (!stripeResponse.ok) {
          return Response.json({ error: 'Payment failed' }, { status: 500, headers: corsHeaders });
        }

        const session = await stripeResponse.json();

        return Response.json({
          sessionId: session.id,
          url: session.url,
        }, { headers: corsHeaders });
      }

      // ====================================================================
      // VOLUNTEER REGISTRATION
      // ====================================================================

      // POST /volunteer
      if (path === '/volunteer' && request.method === 'POST') {
        let body;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: 'Invalid JSON' }, { status: 400, headers: corsHeaders });
        }

        const { email, full_name, phone, availability, interests } = body;

        if (!validateEmail(email) || !validateFullName(full_name)) {
          return Response.json({ error: 'Invalid input' }, { status: 400, headers: corsHeaders });
        }

        const id = generateUUID();

        await env.DB.prepare(
          'INSERT INTO volunteers (id, email, full_name, phone, availability, interests, created_at, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        ).bind(id, email, full_name, phone || '', availability || 'flexible', interests || '', new Date().toISOString(), 'pending').run();

        // Email confirmation
        await sendEmail(
          email,
          'Thank you for volunteering!',
          `<h1>Thanks, ${full_name}!</h1><p>We'll review your volunteer application and contact you soon.</p>`,
          env.RESEND_API_KEY
        );

        return Response.json({ success: true }, { headers: corsHeaders });
      }

      // ====================================================================
      // STRIPE WEBHOOK
      // ====================================================================

      // POST /webhooks/stripe
      if (path === '/webhooks/stripe' && request.method === 'POST') {
        const event = await verifyStripeWebhook(request, env.STRIPE_WEBHOOK_SECRET);
        
        if (!event) {
          return Response.json({ error: 'Invalid signature' }, { status: 401, headers: corsHeaders });
        }

        // Handle payment success
        if (event.type === 'checkout.session.completed') {
          const session = event.data.object;
          const [userId, eventId, quantity] = session.client_reference_id.split(':');

          // Create tickets for the purchase
          for (let i = 0; i < parseInt(quantity); i++) {
            const ticketId = generateUUID();
            const qrCode = generateQRCodeDataUrl(ticketId);

            await env.DB.prepare(
              'INSERT INTO tickets (id, user_id, event_id, status, qr_code, created_at) VALUES (?, ?, ?, ?, ?, ?)'
            ).bind(ticketId, userId, eventId, 'valid', qrCode, new Date().toISOString()).run();

            // Cache ticket
            const ticket = await env.DB.prepare('SELECT * FROM tickets WHERE id = ?').bind(ticketId).first();
            await env.CACHE.put(`ticket:${ticketId}`, JSON.stringify(ticket), { expirationTtl: 2592000 }); // 30 days

            // Send email with ticket
            const user = await env.DB.prepare('SELECT email, full_name FROM users WHERE id = ?').bind(userId).first();
            const event = await env.DB.prepare('SELECT title, date, location FROM events WHERE id = ?').bind(eventId).first();

            await sendEmail(
              user.email,
              `Your Ticket for ${event.title}`,
              `<h1>Ticket Confirmed!</h1><p>Event: ${event.title}</p><p>Date: ${new Date(event.date * 1000).toLocaleDateString()}</p><p>Location: ${event.location}</p><p><img src="${qrCode}" alt="QR Code"/></p>`,
              env.RESEND_API_KEY
            );
          }
        }

        if (event.type === 'charge.refunded') {
          // Mark tickets as refunded
          const chargeId = event.data.object.id;
          // TODO: Link charges to transactions table for refund handling
        }

        return Response.json({ received: true }, { headers: corsHeaders });
      }

      // ====================================================================
      // ADMIN ROUTES
      // ====================================================================

      const adminUser = await verifyJWT(request, env.JWT_SECRET);

      // GET /admin/stats
      if (path === '/admin/stats' && request.method === 'GET') {
        if (!adminUser || adminUser.role !== 'admin') {
          return Response.json({ error: 'Forbidden' }, { status: 403, headers: corsHeaders });
        }

        const users = await env.DB.prepare('SELECT COUNT(*) as count FROM users').first();
        const events = await env.DB.prepare('SELECT COUNT(*) as count FROM events WHERE status = ?').bind('active').first();
        const tickets = await env.DB.prepare('SELECT COUNT(*) as count FROM tickets WHERE status = ?').bind('valid').first();
        const revenue = await env.DB.prepare(
          "SELECT SUM(e.price) as total FROM tickets t JOIN events e ON t.event_id = e.id WHERE t.status IN ('valid','used')"
        ).first();

        return Response.json({
          users: users?.count || 0,
          events: events?.count || 0,
          tickets: tickets?.count || 0,
          revenue: revenue?.total || 0,
        }, { headers: corsHeaders });
      }

      // GET /admin/events
      if (path === '/admin/events' && request.method === 'GET') {
        if (!adminUser || adminUser.role !== 'admin') {
          return Response.json({ error: 'Forbidden' }, { status: 403, headers: corsHeaders });
        }

        const { results } = await env.DB.prepare(`
          SELECT e.*,
                 COALESCE(t.tickets_sold, 0) as tickets_sold,
                 COALESCE(t.tickets_sold, 0) * e.price as revenue
          FROM events e
          LEFT JOIN (
            SELECT event_id, COUNT(*) as tickets_sold
            FROM tickets
            GROUP BY event_id
          ) t ON e.id = t.event_id
          ORDER BY e.date DESC
        `).all();

        return Response.json(results || [], { headers: corsHeaders });
      }

      // POST /admin/events
      if (path === '/admin/events' && request.method === 'POST') {
        if (!adminUser || adminUser.role !== 'admin') {
          return Response.json({ error: 'Forbidden' }, { status: 403, headers: corsHeaders });
        }

        let body;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: 'Invalid JSON' }, { status: 400, headers: corsHeaders });
        }

        const { title, description, date, location, price, image_url, capacity, category, status } = body;

        if (!title || !date || !location) {
          return Response.json({ error: 'Missing required fields' }, { status: 400, headers: corsHeaders });
        }

        const id = generateUUID();

        const allowedStatuses = ['active', 'draft', 'archived', 'cancelled'];
        const normalizedStatus = allowedStatuses.includes(status) ? status : 'active';

        await env.DB.prepare(
          'INSERT INTO events (id, title, description, date, location, price, image_url, capacity, category, status, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        ).bind(
          id,
          title,
          description || '',
          date,
          location,
          price || 0,
          image_url || '',
          capacity || null,
          category || 'general',
          normalizedStatus,
          new Date().toISOString(),
          adminUser.userId
        ).run();

        return Response.json({ success: true, id }, { headers: corsHeaders });
      }

      // PUT /admin/events/:id
      if (path.match(/^\/admin\/events\/[^/]+$/) && request.method === 'PUT') {
        if (!adminUser || adminUser.role !== 'admin') {
          return Response.json({ error: 'Forbidden' }, { status: 403, headers: corsHeaders });
        }

        const id = path.split('/').pop();
        let body;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: 'Invalid JSON' }, { status: 400, headers: corsHeaders });
        }

        const { title, description, date, location, price, image_url, capacity, status, category } = body;

        const allowedStatuses = ['active', 'draft', 'archived', 'cancelled'];
        const normalizedStatus = allowedStatuses.includes(status) ? status : 'active';

        await env.DB.prepare(
          'UPDATE events SET title = ?, description = ?, date = ?, location = ?, price = ?, image_url = ?, capacity = ?, status = ?, category = ?, updated_at = ? WHERE id = ?'
        ).bind(
          title,
          description || '',
          date,
          location,
          price || 0,
          image_url || '',
          capacity || null,
          normalizedStatus,
          category || 'general',
          new Date().toISOString(),
          id
        ).run();

        return Response.json({ success: true }, { headers: corsHeaders });
      }

      // DELETE /admin/events/:id
      if (path.match(/^\/admin\/events\/[^/]+$/) && request.method === 'DELETE') {
        if (!adminUser || adminUser.role !== 'admin') {
          return Response.json({ error: 'Forbidden' }, { status: 403, headers: corsHeaders });
        }

        const id = path.split('/').pop();
        await env.DB.prepare('UPDATE events SET status = ? WHERE id = ?').bind('archived', id).run();

        return Response.json({ success: true }, { headers: corsHeaders });
      }

      // POST /admin/blog
      if (path === '/admin/blog' && request.method === 'POST') {
        if (!adminUser || adminUser.role !== 'admin') {
          return Response.json({ error: 'Forbidden' }, { status: 403, headers: corsHeaders });
        }

        let body;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: 'Invalid JSON' }, { status: 400, headers: corsHeaders });
        }

        const { title, content, category } = body;

        if (!title || !content) {
          return Response.json({ error: 'Title and content required' }, { status: 400, headers: corsHeaders });
        }

        const id = generateUUID();

        await env.DB.prepare(
          'INSERT INTO blog_posts (id, title, content, category, published, published_at, author_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).bind(
          id,
          title,
          content,
          category || 'news',
          1,
          new Date().toISOString(),
          adminUser.userId
        ).run();

        return Response.json({ success: true, id }, { headers: corsHeaders });
      }

      // PUT /admin/tickets/:id
      if (path.match(/^\/admin\/tickets\/[^/]+$/) && request.method === 'PUT') {
        if (!adminUser || adminUser.role !== 'admin') {
          return Response.json({ error: 'Forbidden' }, { status: 403, headers: corsHeaders });
        }

        const ticketId = path.split('/').pop();
        const ticket = await env.DB.prepare('SELECT * FROM tickets WHERE id = ?').bind(ticketId).first();

        if (!ticket) {
          return Response.json({ error: 'Ticket not found' }, { status: 404, headers: corsHeaders });
        }

        if (ticket.status === 'used') {
          return Response.json({ error: 'Ticket already used' }, { status: 400, headers: corsHeaders });
        }

        await env.DB.prepare(
          'UPDATE tickets SET status = ?, used_at = ? WHERE id = ?'
        ).bind('used', new Date().toISOString(), ticketId).run();

        return Response.json({ success: true }, { headers: corsHeaders });
      }

      // GET /admin/volunteers
      if (path === '/admin/volunteers' && request.method === 'GET') {
        if (!adminUser || adminUser.role !== 'admin') {
          return Response.json({ error: 'Forbidden' }, { status: 403, headers: corsHeaders });
        }

        const { results } = await env.DB.prepare(
          'SELECT * FROM volunteers ORDER BY created_at DESC'
        ).all();

        return Response.json(results || [], { headers: corsHeaders });
      }

      return Response.json({ error: 'Not Found' }, { status: 404, headers: corsHeaders });

    } catch (err) {
      console.error('Worker error:', err);
      const corsHeaders = getCorsHeaders(request.headers.get('Origin') || 'https://oklahomabashi.com', env);
      return Response.json(
        { error: err.message || 'Internal server error' },
        { status: 500, headers: corsHeaders }
      );
    }
  }
};
