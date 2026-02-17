export interface User {
  id: string;
  email: string;
  full_name: string;
  role: 'user' | 'admin' | 'volunteer';
}

export interface UserProfile extends User {
  phone?: string | null;
  billing_address1?: string | null;
  billing_address2?: string | null;
  billing_city?: string | null;
  billing_state?: string | null;
  billing_zip?: string | null;
  billing_country?: string | null;
  created_at?: string;
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
  status: 'valid' | 'used';
  qr_code: string;
}

export interface UserTicket {
  id: string;
  event_id: string;
  status: 'valid' | 'used' | 'refunded' | 'cancelled';
  qr_code: string;
  created_at: string;
  title: string;
  date: number;
  location: string;
  price: number;
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
