export interface User {
  id: string;
  email: string;
  full_name: string;
  role: 'user' | 'admin' | 'volunteer';
}

export interface Event {
  id: string;
  title: string;
  description: string;
  date: number; // Unix timestamp
  location: string;
  price: number; // in cents
  image_url: string;
  capacity?: number;
  category?: string;
  status?: 'active' | 'draft' | 'archived' | 'cancelled';
  tickets_sold?: number;
  revenue?: number;
}

export interface Ticket {
  id: string;
  event_id: string;
  event_title: string;
  event_date: number;
  status: 'valid' | 'used';
  qr_code: string;
}

export interface AdminStats {
  users: number;
  events: number;
  tickets: number;
  revenue: number;
}

export interface BlogPost {
  id: string;
  title: string;
  content: string;
  published_at: number;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
}
