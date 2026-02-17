-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT,
    role TEXT DEFAULT 'user', -- 'user', 'admin', 'volunteer'
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Events Table
CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    date INTEGER NOT NULL,
    location TEXT NOT NULL,
    price INTEGER DEFAULT 0, -- in cents
    image_url TEXT,
    capacity INTEGER,
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Tickets Table
CREATE TABLE IF NOT EXISTS tickets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    event_id TEXT NOT NULL,
    status TEXT DEFAULT 'valid', -- 'valid', 'used', 'refunded'
    qr_code TEXT,
    purchase_date INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (event_id) REFERENCES events(id)
);

-- Blog Posts
CREATE TABLE IF NOT EXISTS blog_posts (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    author_id TEXT NOT NULL,
    published_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (author_id) REFERENCES users(id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_tickets_user ON tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_event ON tickets(event_id);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);

-- Seed Admin (Password: admin123 - strictly for demo, change in prod)
INSERT OR IGNORE INTO users (id, email, password_hash, full_name, role) 
VALUES ('admin-uuid', 'admin@oklahomabashi.com', '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8', 'System Admin', 'admin');
