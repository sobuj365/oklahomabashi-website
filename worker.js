/**
 * OKLAHOMABASHI - Cloudflare Worker Backend
 * 
 * BINDINGS REQUIRED IN CLOUDFLARE DASHBOARD:
 * - DB (D1 Database)
 * - KV (KV Namespace)
 * - JWT_SECRET (Encrypted Env Var) - Default: 'your-secret-key-change-in-production'
 * - STRIPE_SECRET_KEY (Encrypted Env Var, optional)
 * - ALLOWED_ORIGIN / ALLOWED_ORIGINS (Encrypted Env Var, optional)
 */

const DEFAULT_ALLOWED_ORIGINS = [
  'https://oklahomabashi.pages.dev',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:4173',
];

const uniqueOrigins = (origins) => Array.from(new Set(origins.filter(Boolean)));

const getAllowedOrigins = (env) => {
  const configured = env.ALLOWED_ORIGINS || env.ALLOWED_ORIGIN;
  if (!configured) return DEFAULT_ALLOWED_ORIGINS;

  if (configured.trim().startsWith('[')) {
    try {
      const parsed = JSON.parse(configured);
      if (Array.isArray(parsed)) {
        return uniqueOrigins([...DEFAULT_ALLOWED_ORIGINS, ...parsed.map((origin) => String(origin).trim())]);
      }
    } catch {
    }
  }

  const configuredOrigins = configured
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return uniqueOrigins([...DEFAULT_ALLOWED_ORIGINS, ...configuredOrigins]);
};

const resolveCorsOrigin = (requestOrigin, allowedOrigins) => {
  if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
    return requestOrigin;
  }

  return allowedOrigins[0] || DEFAULT_ALLOWED_ORIGINS[0];
};

const getCorsHeaders = (origin) => ({
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS, PUT, DELETE',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
});

// Utils
const generateUUID = () => crypto.randomUUID();

// Validation utilities
const validateEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email) && email.length <= 255;
};

const validatePassword = (password) => {
  // Minimum 8 chars, at least one uppercase, one lowercase, one number
  return password.length >= 8 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /[0-9]/.test(password);
};

const validateFullName = (name) => {
  return typeof name === 'string' && name.trim().length >= 2 && name.trim().length <= 100;
};

// Higher security password hashing using PBKDF2
async function hashPassword(password, salt = null) {
  // Generate salt if not provided
  if (!salt) {
    const saltBuffer = crypto.getRandomValues(new Uint8Array(16));
    salt = Array.from(saltBuffer).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  const passwordBuffer = new TextEncoder().encode(password);
  const saltBuffer = new Uint8Array(salt.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
  
  const key = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  
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

// Verify password with salt
async function verifyPassword(password, storedHash) {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [salt, _] = storedHash.split(':');
  const newHash = await hashPassword(password, salt);
  return newHash === storedHash;
}

// JWT Implementation with proper expiration
async function signJWT(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const expiresIn = 86400; // 24 hours
  
  const encodedHeader = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const encodedPayload = btoa(JSON.stringify({
    ...payload,
    iat: now,
    exp: now + expiresIn
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
    
    // Verify signature
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
    
    // Decode and validate payload
    const standardPayload = (payload + '==').replace(/-/g, '+').replace(/_/g, '/');
    const decodedPayload = JSON.parse(atob(standardPayload));
    
    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (decodedPayload.exp < now) return null;
    
    return decodedPayload;
  } catch (e) {
    console.error('JWT verification error:', e);
    return null;
  }
}

// Rate limiting helper
async function checkRateLimit(kv, key, limit = 5, windowSeconds = 60) {
  const rateLimitKey = `ratelimit:${key}`;
  const current = await kv.get(rateLimitKey);
  const count = current ? parseInt(current) : 0;
  
  if (count >= limit) {
    return false;
  }
  
  await kv.put(rateLimitKey, String(count + 1), { expirationTtl: windowSeconds });
  return true;
}

// Router Handler
export default {
  async fetch(request, env, ctx) {
    const allowedOrigins = getAllowedOrigins(env);
    const origin = resolveCorsOrigin(request.headers.get('Origin'), allowedOrigins);
    const corsHeaders = getCorsHeaders(origin);
    
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    if (url.protocol === 'http:') {
      url.protocol = 'https:';
      return Response.redirect(url.toString(), 301);
    }
    const path = url.pathname;

    try {
      // --- AUTH ROUTES ---
      if (path === '/auth/register' && request.method === 'POST') {
        // Rate limit: 3 registrations per 5 minutes per IP
        const ip = request.headers.get('cf-connecting-ip') || 'unknown';
        const canRegister = await checkRateLimit(env.KV, `reg:${ip}`, 3, 300);
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
          return Response.json(
            { error: 'Invalid JSON request body' },
            { status: 400, headers: corsHeaders }
          );
        }

        const { email, password, full_name } = body;
        
        // Validation
        if (!validateEmail(email)) {
          return Response.json(
            { error: 'Invalid email format' },
            { status: 400, headers: corsHeaders }
          );
        }
        if (!validatePassword(password)) {
          return Response.json(
            { error: 'Password must be at least 8 chars with uppercase, lowercase, and number' },
            { status: 400, headers: corsHeaders }
          );
        }
        if (!validateFullName(full_name)) {
          return Response.json(
            { error: 'Full name must be 2-100 characters' },
            { status: 400, headers: corsHeaders }
          );
        }

        // Check existing
        const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
        if (existing) {
          return Response.json(
            { error: 'User already exists' },
            { status: 400, headers: corsHeaders }
          );
        }

        const id = generateUUID();
        const hash = await hashPassword(password);
        
        await env.DB.prepare(
          'INSERT INTO users (id, email, password_hash, full_name, role, created_at) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind(id, email, hash, full_name.trim(), 'user', new Date().toISOString()).run();

        return Response.json({ success: true, id }, { headers: corsHeaders });
      }

      if (path === '/auth/login' && request.method === 'POST') {
        // Rate limit: 5 login attempts per minute per IP
        const ip = request.headers.get('cf-connecting-ip') || 'unknown';
        const canLogin = await checkRateLimit(env.KV, `login:${ip}`, 5, 60);
        if (!canLogin) {
          return Response.json(
            { error: 'Too many login attempts. Try again later.' },
            { status: 429, headers: corsHeaders }
          );
        }

        let body;
        try {
          body = await request.json();
        } catch {
          return Response.json(
            { error: 'Invalid JSON request body' },
            { status: 400, headers: corsHeaders }
          );
        }

        const { email, password } = body;
        
        if (!email || !password) {
          return Response.json(
            { error: 'Email and password required' },
            { status: 400, headers: corsHeaders }
          );
        }

        const user = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();

        if (!user || !await verifyPassword(password, user.password_hash)) {
          return Response.json(
            { error: 'Invalid credentials' },
            { status: 401, headers: corsHeaders }
          );
        }

        const token = await signJWT(
          { id: user.id, email: user.email, role: user.role },
          env.JWT_SECRET || 'secret-dev'
        );
        
        return Response.json(
          {
            token,
            user: {
              id: user.id,
              email: user.email,
              role: user.role,
              full_name: user.full_name
            }
          },
          { headers: corsHeaders }
        );
      }

      // --- PUBLIC ROUTES ---
      // List Events (upcoming only)
      if (path === '/events' && request.method === 'GET') {
        const now = Math.floor(Date.now() / 1000);
        const { results } = await env.DB.prepare(
          'SELECT * FROM events WHERE date >= ? ORDER BY date ASC'
        ).bind(now).all();
        return Response.json(results || [], { headers: corsHeaders });
      }

      // Get Single Event
      if (path.match(/^\/events\/[^/]+$/) && request.method === 'GET') {
        const id = path.split('/').pop();
        const event = await env.DB.prepare('SELECT * FROM events WHERE id = ?').bind(id).first();
        if (!event) {
          return Response.json(
            { error: 'Event not found' },
            { status: 404, headers: corsHeaders }
          );
        }
        return Response.json(event, { headers: corsHeaders });
      }
      
      // List Blog Posts
      if (path === '/blog' && request.method === 'GET') {
        const { results } = await env.DB.prepare(
          'SELECT * FROM blog_posts ORDER BY published_at DESC LIMIT 50'
        ).all();
        return Response.json(results || [], { headers: corsHeaders });
      }

      // --- PROTECTED ROUTES ---
      const user = await verifyJWT(request, env.JWT_SECRET || 'secret-dev');
      
      if (path === '/tickets/purchase' && request.method === 'POST') {
        if (!user) {
          return Response.json(
            { error: 'Unauthorized' },
            { status: 401, headers: corsHeaders }
          );
        }

        let body;
        try {
          body = await request.json();
        } catch {
          return Response.json(
            { error: 'Invalid JSON request body' },
            { status: 400, headers: corsHeaders }
          );
        }

        const { event_id, quantity = 1 } = body;
        const parsedQuantity = Number(quantity);
        if (!event_id) {
          return Response.json(
            { error: 'event_id required' },
            { status: 400, headers: corsHeaders }
          );
        }

        if (!Number.isInteger(parsedQuantity) || parsedQuantity < 1 || parsedQuantity > 20) {
          return Response.json(
            { error: 'Invalid ticket quantity' },
            { status: 400, headers: corsHeaders }
          );
        }

        // Get event and check capacity
        const event = await env.DB.prepare('SELECT * FROM events WHERE id = ?').bind(event_id).first();
        if (!event) {
          return Response.json(
            { error: 'Event not found' },
            { status: 404, headers: corsHeaders }
          );
        }

        // Check if already purchased
        const alreadyPurchased = await env.DB.prepare(
          'SELECT id FROM tickets WHERE user_id = ? AND event_id = ?'
        ).bind(user.id, event_id).first();
        if (alreadyPurchased) {
          return Response.json(
            { error: 'You already have a ticket for this event' },
            { status: 400, headers: corsHeaders }
          );
        }

        // Check capacity if set
        if (event.capacity) {
          const { results: tickets } = await env.DB.prepare(
            'SELECT COUNT(*) as count FROM tickets WHERE event_id = ?'
          ).bind(event_id).all();
          const ticketCount = tickets?.[0]?.count || 0;
          if (ticketCount + parsedQuantity > event.capacity) {
            return Response.json(
              { error: 'Event is at capacity' },
              { status: 400, headers: corsHeaders }
            );
          }
        }

        const ticketIds = [];
        for (let i = 0; i < parsedQuantity; i += 1) {
          const ticketId = generateUUID();
          const qrCode = `${event_id}:${user.id}:${ticketId}`;

          // TODO: Verify Stripe payment here if this is a paid event
          // Payment verification would go here before creating the ticket

          await env.DB.prepare(
            'INSERT INTO tickets (id, user_id, event_id, qr_code, status, created_at) VALUES (?, ?, ?, ?, ?, ?)'
          ).bind(ticketId, user.id, event_id, qrCode, 'valid', new Date().toISOString()).run();

          // Cache for quick lookup at door
          await env.KV.put(`ticket:${ticketId}`, JSON.stringify({
            valid: true,
            event_id,
            user_id: user.id,
            used: false
          }), { expirationTtl: 7776000 }); // 90 days

          ticketIds.push(ticketId);
        }

        return Response.json({ success: true, ticketIds }, { headers: corsHeaders });
      }
      
      if (path === '/user/tickets' && request.method === 'GET') {
        if (!user) {
          return Response.json(
            { error: 'Unauthorized' },
            { status: 401, headers: corsHeaders }
          );
        }
        const { results } = await env.DB.prepare(`
          SELECT t.id, t.event_id, t.status, t.qr_code, t.created_at,
                 e.title as event_title, e.date as event_date, e.location
          FROM tickets t 
          JOIN events e ON t.event_id = e.id 
          WHERE t.user_id = ?
          ORDER BY e.date DESC
        `).bind(user.id).all();
        return Response.json(results || [], { headers: corsHeaders });
      }

      // --- ADMIN ROUTES ---
      if (path.startsWith('/admin')) {
        if (!user || user.role !== 'admin') {
          return Response.json(
            { error: 'Forbidden' },
            { status: 403, headers: corsHeaders }
          );
        }

        if (path === '/admin/stats' && request.method === 'GET') {
          const usersCount = await env.DB.prepare('SELECT COUNT(*) as count FROM users').first();
          const ticketsCount = await env.DB.prepare('SELECT COUNT(*) as count FROM tickets').first();
          const revenue = await env.DB.prepare(
            'SELECT SUM(e.price) as total FROM events e JOIN tickets t ON e.id = t.event_id'
          ).first();
          const eventsCount = await env.DB.prepare('SELECT COUNT(*) as count FROM events').first();
          
          return Response.json({
            users: usersCount?.count || 0,
            tickets: ticketsCount?.count || 0,
            events: eventsCount?.count || 0,
            revenue: revenue?.total || 0
          }, { headers: corsHeaders });
        }

        // Create Event
        if (path === '/admin/events' && request.method === 'POST') {
          let body;
          try {
            body = await request.json();
          } catch {
            return Response.json(
              { error: 'Invalid JSON request body' },
              { status: 400, headers: corsHeaders }
            );
          }

          const { title, description, date, location, price, image_url, capacity } = body;

          if (!title || !date || !location) {
            return Response.json(
              { error: 'title, date, and location are required' },
              { status: 400, headers: corsHeaders }
            );
          }

          const id = generateUUID();
          await env.DB.prepare(
            'INSERT INTO events (id, title, description, date, location, price, image_url, capacity, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
          ).bind(id, title, description || '', date, location, price || 0, image_url || '', capacity || null, new Date().toISOString()).run();

          return Response.json({ success: true, id }, { headers: corsHeaders });
        }

        // Update Event
        if (path.match(/^\/admin\/events\/[^/]+$/) && request.method === 'PUT') {
          const id = path.split('/').pop();
          let body;
          try {
            body = await request.json();
          } catch {
            return Response.json(
              { error: 'Invalid JSON request body' },
              { status: 400, headers: corsHeaders }
            );
          }

          const { title, description, date, location, price, image_url, capacity } = body;
          
          await env.DB.prepare(
            'UPDATE events SET title = ?, description = ?, date = ?, location = ?, price = ?, image_url = ?, capacity = ? WHERE id = ?'
          ).bind(title, description || '', date, location, price || 0, image_url || '', capacity || null, id).run();

          return Response.json({ success: true }, { headers: corsHeaders });
        }

        // Delete Event
        if (path.match(/^\/admin\/events\/[^/]+$/) && request.method === 'DELETE') {
          const id = path.split('/').pop();
          await env.DB.prepare('DELETE FROM events WHERE id = ?').bind(id).run();
          return Response.json({ success: true }, { headers: corsHeaders });
        }

        // Validate Ticket (mark as used - for door entry)
        if (path.match(/^\/admin\/tickets\/[^/]+$/) && request.method === 'PUT') {
          const ticketId = path.split('/').pop();
          
          const ticket = await env.DB.prepare('SELECT * FROM tickets WHERE id = ?').bind(ticketId).first();
          if (!ticket) {
            return Response.json(
              { error: 'Ticket not found' },
              { status: 404, headers: corsHeaders }
            );
          }

          if (ticket.status === 'used') {
            return Response.json(
              { error: 'Ticket already used' },
              { status: 400, headers: corsHeaders }
            );
          }

          await env.DB.prepare('UPDATE tickets SET status = ?, used_at = ? WHERE id = ?')
            .bind('used', new Date().toISOString(), ticketId).run();

          await env.KV.put(`ticket:${ticketId}`, JSON.stringify({
            valid: true,
            event_id: ticket.event_id,
            user_id: ticket.user_id,
            used: true
          }));

          return Response.json({ success: true, message: 'Ticket validated and marked as used' }, { headers: corsHeaders });
        }

        // List all users (admin only)
        if (path === '/admin/users' && request.method === 'GET') {
          const { results } = await env.DB.prepare(
            'SELECT id, email, full_name, role, created_at FROM users ORDER BY created_at DESC'
          ).all();
          return Response.json(results || [], { headers: corsHeaders });
        }
      }

      return Response.json({ error: 'Not Found' }, { status: 404, headers: corsHeaders });

    } catch (err) {
      console.error('Error:', err);
      return Response.json(
        { error: err.message || 'Internal server error' },
        { status: 500, headers: corsHeaders }
      );
    }
  }
};