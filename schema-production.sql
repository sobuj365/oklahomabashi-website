-- ============================================================================
-- OKLAHOMABASHI PRODUCTION DATABASE SCHEMA
-- Cloudflare D1 Database
-- ============================================================================

-- ============================================================================
-- USERS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  role TEXT DEFAULT 'user', -- 'user', 'admin', 'volunteer'
  avatar_url TEXT,
  bio TEXT,
  newsletter_subscribed BOOLEAN DEFAULT 1,
  is_active BOOLEAN DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  last_login_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);

-- ============================================================================
-- EVENTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'cultural', -- 'cultural', 'sports', 'educational', 'charity'
  date INTEGER NOT NULL, -- Unix timestamp
  location TEXT NOT NULL,
  latitude REAL,
  longitude REAL,
  price INTEGER DEFAULT 0, -- in cents ($0.00 = 0, $25.00 = 2500)
  image_url TEXT,
  capacity INTEGER,
  status TEXT DEFAULT 'active', -- 'active', 'draft', 'archived', 'cancelled'
  created_by TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_category ON events(category);
CREATE INDEX IF NOT EXISTS idx_events_created_by ON events(created_by);

-- ============================================================================
-- TICKETS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS tickets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  status TEXT DEFAULT 'valid', -- 'valid', 'used', 'refunded', 'cancelled'
  qr_code TEXT, -- QR code data URL or image
  quantity INTEGER DEFAULT 1,
  price_paid INTEGER, -- amount paid in cents at time of purchase
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  used_at TEXT,
  cancelled_at TEXT,
  refunded_at TEXT,
  notes TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (event_id) REFERENCES events(id)
);

CREATE INDEX IF NOT EXISTS idx_tickets_user ON tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_event ON tickets(event_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON tickets(created_at);

-- ============================================================================
-- TRANSACTIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  event_id TEXT,
  ticket_id TEXT,
  type TEXT NOT NULL, -- 'ticket_purchase', 'donation', 'refund'
  amount INTEGER NOT NULL, -- in cents
  currency TEXT DEFAULT 'USD',
  status TEXT DEFAULT 'pending', -- 'pending', 'completed', 'failed', 'refunded'
  stripe_session_id TEXT UNIQUE,
  stripe_payment_intent_id TEXT,
  reference_id TEXT, -- External reference
  metadata TEXT, -- JSON metadata
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  failed_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (event_id) REFERENCES events(id),
  FOREIGN KEY (ticket_id) REFERENCES tickets(id)
);

CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_stripe_session ON transactions(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);

-- ============================================================================
-- DONATIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS donations (
  id TEXT PRIMARY KEY,
  donor_email TEXT NOT NULL,
  donor_name TEXT,
  amount INTEGER NOT NULL, -- in cents
  currency TEXT DEFAULT 'USD',
  message TEXT,
  is_anonymous BOOLEAN DEFAULT 0,
  status TEXT DEFAULT 'completed', -- 'pending', 'completed', 'failed'
  transaction_id TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (transaction_id) REFERENCES transactions(id)
);

CREATE INDEX IF NOT EXISTS idx_donations_email ON donations(donor_email);
CREATE INDEX IF NOT EXISTS idx_donations_status ON donations(status);
CREATE INDEX IF NOT EXISTS idx_donations_created_at ON donations(created_at);

-- ============================================================================
-- BLOG POSTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS blog_posts (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT UNIQUE,
  content TEXT NOT NULL,
  excerpt TEXT,
  category TEXT DEFAULT 'news', -- 'news', 'event_recap', 'cultural_guide', 'announcements'
  featured_image_url TEXT,
  author_id TEXT NOT NULL,
  published BOOLEAN DEFAULT 0,
  view_count INTEGER DEFAULT 0,
  published_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (author_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_blog_slug ON blog_posts(slug);
CREATE INDEX IF NOT EXISTS idx_blog_published ON blog_posts(published);
CREATE INDEX IF NOT EXISTS idx_blog_category ON blog_posts(category);
CREATE INDEX IF NOT EXISTS idx_blog_author ON blog_posts(author_id);
CREATE INDEX IF NOT EXISTS idx_blog_published_at ON blog_posts(published_at);

-- ============================================================================
-- VOLUNTEERS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS volunteers (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  availability TEXT, -- 'weekdays', 'weekends', 'flexible'
  interests TEXT, -- JSON array of interests
  skills TEXT, -- JSON array of skills
  status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'inactive'
  hours_volunteered INTEGER DEFAULT 0,
  joined_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_volunteers_email ON volunteers(email);
CREATE INDEX IF NOT EXISTS idx_volunteers_status ON volunteers(status);
CREATE INDEX IF NOT EXISTS idx_volunteers_created_at ON volunteers(created_at);

-- ============================================================================
-- CATEGORIES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  slug TEXT UNIQUE,
  description TEXT,
  icon_url TEXT,
  color TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);
CREATE INDEX IF NOT EXISTS idx_categories_display_order ON categories(display_order);

-- ============================================================================
-- AUDIT LOG TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  action TEXT NOT NULL, -- 'create', 'update', 'delete', 'login', 'payment'
  resource_type TEXT, -- 'event', 'user', 'ticket', 'donation'
  resource_id TEXT,
  old_values TEXT, -- JSON of previous values
  new_values TEXT, -- JSON of new values
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_logs(created_at);

-- ============================================================================
-- EMAIL QUEUE TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS email_queue (
  id TEXT PRIMARY KEY,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  html_content TEXT,
  type TEXT, -- 'registration', 'ticket_purchase', 'donation_receipt', 'password_reset'
  status TEXT DEFAULT 'pending', -- 'pending', 'sent', 'failed'
  retry_count INTEGER DEFAULT 0,
  error_message TEXT,
  sent_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_email_status ON email_queue(status);
CREATE INDEX IF NOT EXISTS idx_email_created_at ON email_queue(created_at);

-- ============================================================================
-- NOTIFICATION PREFERENCES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS notification_preferences (
  id TEXT PRIMARY KEY,
  user_id TEXT UNIQUE NOT NULL,
  email_event_updates BOOLEAN DEFAULT 1,
  email_new_events BOOLEAN DEFAULT 1,
  email_promotional BOOLEAN DEFAULT 1,
  push_notifications BOOLEAN DEFAULT 0,
  sms_notifications BOOLEAN DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_notif_user ON notification_preferences(user_id);

-- ============================================================================
-- ATTENDANCE TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS attendance (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  ticket_id TEXT,
  user_id TEXT,
  checked_in_at TEXT NOT NULL,
  checked_in_by TEXT, -- admin who checked in
  notes TEXT,
  FOREIGN KEY (event_id) REFERENCES events(id),
  FOREIGN KEY (ticket_id) REFERENCES tickets(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (checked_in_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_attendance_event ON attendance(event_id);
CREATE INDEX IF NOT EXISTS idx_attendance_ticket ON attendance(ticket_id);
CREATE INDEX IF NOT EXISTS idx_attendance_user ON attendance(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_checked_in_at ON attendance(checked_in_at);

-- ============================================================================
-- DATA INTEGRITY CHECKS
-- ============================================================================

-- Ensure event dates are in the future when creating
-- (Application-level check recommended)

-- Ensure prices are non-negative
-- (Application-level check recommended)

-- Ensure email addresses are valid format
-- (Application-level validation recommended)

-- ============================================================================
-- SAMPLE DATA (OPTIONAL - Comment out in production)
-- ============================================================================

-- INSERT INTO categories (id, name, slug, description, color, display_order)
-- VALUES 
--   (1, 'Cultural', 'cultural', 'Traditional and cultural events', '#22c55e', 1),
--   (2, 'Sports', 'sports', 'Sports and recreation events', '#3b82f6', 2),
--   (3, 'Educational', 'educational', 'Workshops and educational programs', '#f59e0b', 3),
--   (4, 'Charity', 'charity', 'Fundraisers and charity events', '#ec4899', 4);
