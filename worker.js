/**
 * OKLAHOMABASHI - Cloudflare Worker Backend
 * 
 * BINDINGS REQUIRED IN DASHBOARD:
 * - DB (D1 Database)
 * - KV (KV Namespace)
 * - JWT_SECRET (Encrypted Env Var)
 * - STRIPE_SECRET_KEY (Encrypted Env Var)
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS, PUT, DELETE',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Utils
const generateUUID = () => crypto.randomUUID();

async function hashPassword(password) {
  const msgBuffer = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// JWT Implementation (Simplified for Worker environment)
async function signJWT(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = btoa(JSON.stringify(header));
  const encodedPayload = btoa(JSON.stringify({ ...payload, exp: Date.now() + 86400000 })); // 24h
  const signatureInput = `${encodedHeader}.${encodedPayload}`;
  
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signatureInput));
  const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  
  return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
}

async function verifyJWT(request, secret) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  
  try {
    const [header, payload, signature] = token.split('.');
    const key = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
    );
    
    // Convert url-safe base64 back to standard
    const standardSignature = signature.replace(/-/g, '+').replace(/_/g, '/');
    const signatureBin = Uint8Array.from(atob(standardSignature), c => c.charCodeAt(0));
    
    const isValid = await crypto.subtle.verify(
      'HMAC', key, signatureBin, new TextEncoder().encode(`${header}.${payload}`)
    );
    
    if (!isValid) return null;
    return JSON.parse(atob(payload));
  } catch (e) {
    return null;
  }
}

// Router Handler
export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // --- AUTH ROUTES ---
      if (path === '/auth/register' && request.method === 'POST') {
        const body = await request.json();
        const { email, password, full_name } = body;
        
        // Check existing
        const existing = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
        if (existing) return Response.json({ error: 'User already exists' }, { status: 400, headers: corsHeaders });

        const id = generateUUID();
        const hash = await hashPassword(password);
        
        await env.DB.prepare('INSERT INTO users (id, email, password_hash, full_name) VALUES (?, ?, ?, ?)')
          .bind(id, email, hash, full_name).run();

        return Response.json({ success: true, id }, { headers: corsHeaders });
      }

      if (path === '/auth/login' && request.method === 'POST') {
        const { email, password } = await request.json();
        const hash = await hashPassword(password);
        
        const user = await env.DB.prepare('SELECT * FROM users WHERE email = ? AND password_hash = ?')
          .bind(email, hash).first();

        if (!user) return Response.json({ error: 'Invalid credentials' }, { status: 401, headers: corsHeaders });

        const token = await signJWT({ id: user.id, email: user.email, role: user.role }, env.JWT_SECRET || 'secret-dev');
        return Response.json({ token, user: { id: user.id, email: user.email, role: user.role, full_name: user.full_name } }, { headers: corsHeaders });
      }

      // --- PUBLIC ROUTES ---
      if (path === '/events' && request.method === 'GET') {
        const { results } = await env.DB.prepare('SELECT * FROM events ORDER BY date ASC').all();
        return Response.json(results, { headers: corsHeaders });
      }
      
      if (path === '/blog' && request.method === 'GET') {
          const { results } = await env.DB.prepare('SELECT * FROM blog_posts ORDER BY published_at DESC').all();
          return Response.json(results, { headers: corsHeaders });
      }

      // --- PROTECTED ROUTES ---
      const user = await verifyJWT(request, env.JWT_SECRET || 'secret-dev');
      
      if (path === '/tickets/purchase' && request.method === 'POST') {
        if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
        
        const { event_id } = await request.json();
        const ticketId = generateUUID();
        
        // In a real app, verify Stripe payment here using env.STRIPE_SECRET_KEY
        
        await env.DB.prepare('INSERT INTO tickets (id, user_id, event_id, qr_code) VALUES (?, ?, ?, ?)')
          .bind(ticketId, user.id, event_id, `QR-${ticketId}`).run();
          
        // Cache for quick lookup at door
        await env.KV.put(`ticket:${ticketId}`, JSON.stringify({ valid: true, event_id }));

        return Response.json({ success: true, ticketId }, { headers: corsHeaders });
      }
      
      if (path === '/user/tickets' && request.method === 'GET') {
          if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
          const { results } = await env.DB.prepare(`
            SELECT t.*, e.title as event_title, e.date as event_date 
            FROM tickets t 
            JOIN events e ON t.event_id = e.id 
            WHERE t.user_id = ?
          `).bind(user.id).all();
          return Response.json(results, { headers: corsHeaders });
      }

      // --- ADMIN ROUTES ---
      if (path.startsWith('/admin')) {
        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Forbidden' }, { status: 403, headers: corsHeaders });
        }

        if (path === '/admin/stats') {
            const usersCount = await env.DB.prepare('SELECT count(*) as count FROM users').first();
            const ticketsCount = await env.DB.prepare('SELECT count(*) as count FROM tickets').first();
            const revenue = await env.DB.prepare('SELECT sum(price) as total FROM events e JOIN tickets t ON e.id = t.event_id').first();
            
            return Response.json({
                users: usersCount.count,
                tickets: ticketsCount.count,
                revenue: revenue.total || 0
            }, { headers: corsHeaders });
        }
      }

      return Response.json({ error: 'Not Found' }, { status: 404, headers: corsHeaders });

    } catch (err) {
      return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
    }
  }
};
