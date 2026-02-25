// ============================================================================
// OKLAHOMABASHI API SERVICE LAYER
// ============================================================================
// Copy this file to your frontend project (e.g., services/api.ts)
// This provides type-safe API integration for React/Next.js

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface User {
  id: string;
  email: string;
  full_name: string;
  role: 'user' | 'admin' | 'volunteer';
  created_at?: string;
}

interface Event {
  id: string;
  title: string;
  description: string;
  category: string;
  date: number; // Unix timestamp
  location: string;
  price: number; // in cents
  image_url: string;
  capacity?: number;
  status: 'active' | 'draft' | 'archived';
}

interface Ticket {
  id: string;
  event_id: string;
  status: 'valid' | 'used' | 'refunded';
  qr_code: string;
  created_at: string;
}

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  content: string;
  category: string;
  published_at: string;
  author_id: string;
}

interface AuthResponse {
  token: string;
  user: User;
}

interface StripeSessionResponse {
  sessionId: string;
  url: string;
}

// ============================================================================
// API CLIENT CLASS
// ============================================================================

class APIClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string = import.meta.env.VITE_API_URL || 'https://oklahomabashi-api.sobuj1.workers.dev') {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.loadToken();
  }

  /**
   * Load JWT token from localStorage
   */
  private loadToken(): void {
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('oklahomabashi_token');
    }
  }

  /**
   * Set JWT token
   */
  private setToken(token: string): void {
    this.token = token;
    if (typeof window !== 'undefined') {
      localStorage.setItem('oklahomabashi_token', token);
    }
  }

  /**
   * Clear JWT token
   */
  private clearToken(): void {
    this.token = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('oklahomabashi_token');
    }
  }

  /**
   * Make API request with authentication
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    requiresAuth: boolean = false
  ): Promise<T> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (requiresAuth && this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      // Check if token is invalid
      if (response.status === 401 && requiresAuth) {
        this.clearToken();
        // Redirect to login if in browser
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
      }
      throw new Error(data.error || `API Error: ${response.status}`);
    }

    return data;
  }

  // ========================================================================
  // AUTH ENDPOINTS
  // ========================================================================

  /**
   * Register new user
   */
  async register(email: string, password: string, full_name: string): Promise<void> {
    await this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, full_name }),
    });
  }

  /**
   * Login user
   */
  async login(email: string, password: string): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (response.token) {
      this.setToken(response.token);
    }

    return response;
  }

  /**
   * Get current user profile
   */
  async getProfile(): Promise<User> {
    return this.request<User>('/auth/profile', { method: 'GET' }, true);
  }

  /**
   * Logout user (client-side only)
   */
  logout(): void {
    this.clearToken();
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return !!this.token;
  }

  // ========================================================================
  // EVENTS ENDPOINTS
  // ========================================================================

  /**
   * Get all upcoming events
   */
  async getEvents(): Promise<Event[]> {
    return this.request<Event[]>('/events', { method: 'GET' });
  }

  /**
   * Get single event by ID
   */
  async getEvent(eventId: string): Promise<Event> {
    return this.request<Event>(`/events/${eventId}`, { method: 'GET' });
  }

  /**
   * Create event (admin only)
   */
  async createEvent(event: Partial<Event>): Promise<{ success: boolean; id: string }> {
    return this.request('/admin/events', {
      method: 'POST',
      body: JSON.stringify(event),
    }, true);
  }

  /**
   * Update event (admin only)
   */
  async updateEvent(eventId: string, event: Partial<Event>): Promise<{ success: boolean }> {
    return this.request(`/admin/events/${eventId}`, {
      method: 'PUT',
      body: JSON.stringify(event),
    }, true);
  }

  /**
   * Delete event (admin only)
   */
  async deleteEvent(eventId: string): Promise<{ success: boolean }> {
    return this.request(`/admin/events/${eventId}`, {
      method: 'DELETE',
    }, true);
  }

  // ========================================================================
  // TICKETS ENDPOINTS
  // ========================================================================

  /**
   * Purchase tickets for event (initiates Stripe checkout)
   */
  async purchaseTickets(eventId: string, quantity: number = 1): Promise<StripeSessionResponse> {
    return this.request('/tickets/purchase', {
      method: 'POST',
      body: JSON.stringify({ event_id: eventId, quantity }),
    }, true);
  }

  /**
   * Verify ticket by ID
   */
  async verifyTicket(ticketId: string): Promise<Ticket> {
    return this.request<Ticket>(`/tickets/verify/${ticketId}`, { method: 'GET' });
  }

  /**
   * Get user's tickets
   */
  async getUserTickets(): Promise<Ticket[]> {
    return this.request<Ticket[]>('/user/tickets', { method: 'GET' }, true);
  }

  /**
   * Mark ticket as used (admin only)
   */
  async useTicket(ticketId: string): Promise<{ success: boolean }> {
    return this.request(`/admin/tickets/${ticketId}`, {
      method: 'PUT',
    }, true);
  }

  // ========================================================================
  // BLOG ENDPOINTS
  // ========================================================================

  /**
   * Get all published blog posts
   */
  async getBlogPosts(): Promise<BlogPost[]> {
    return this.request<BlogPost[]>('/blog', { method: 'GET' });
  }

  /**
   * Create blog post (admin only)
   */
  async createBlogPost(post: Partial<BlogPost>): Promise<{ success: boolean; id: string }> {
    return this.request('/admin/blog', {
      method: 'POST',
      body: JSON.stringify(post),
    }, true);
  }

  // ========================================================================
  // DONATIONS ENDPOINTS
  // ========================================================================

  /**
   * Create donation (initiates Stripe checkout)
   */
  async donate(
    amount: number,
    donor_email: string,
    donor_name: string,
    message?: string
  ): Promise<StripeSessionResponse> {
    return this.request('/donate', {
      method: 'POST',
      body: JSON.stringify({
        amount: Math.round(amount * 100), // Convert to cents
        donor_email,
        donor_name,
        message,
      }),
    });
  }

  // ========================================================================
  // VOLUNTEER ENDPOINTS
  // ========================================================================

  /**
   * Register as volunteer
   */
  async registerAsVolunteer(
    email: string,
    full_name: string,
    phone?: string,
    availability?: string,
    interests?: string[]
  ): Promise<{ success: boolean }> {
    return this.request('/volunteer', {
      method: 'POST',
      body: JSON.stringify({
        email,
        full_name,
        phone,
        availability,
        interests: interests?.join(','),
      }),
    });
  }

  // ========================================================================
  // ADMIN ENDPOINTS
  // ========================================================================

  /**
   * Get admin statistics (admin only)
   */
  async getAdminStats(): Promise<{
    users: number;
    events: number;
    tickets: number;
    revenue: number;
  }> {
    return this.request('/admin/stats', { method: 'GET' }, true);
  }

  /**
   * Get all volunteers (admin only)
   */
  async getVolunteers(): Promise<any[]> {
    return this.request('/admin/volunteers', { method: 'GET' }, true);
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const api = new APIClient();

// ============================================================================
// REACT HOOKS FOR API USAGE
// ============================================================================

import { useState, useCallback, useEffect } from 'react';

/**
 * Hook for managing API calls with loading, error, and data states
 */
export function useApi<T>(
  apiFunc: () => Promise<T>,
  deps: React.DependencyList = []
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await apiFunc();
      setData(result);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, deps);

  return { data, loading, error, execute };
}

/**
 * Hook for auth state management
 */
export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    if (api.isAuthenticated()) {
      api.getProfile()
        .then(setUser)
        .then(() => setIsAuthenticated(true))
        .catch(() => {
          api.logout();
          setIsAuthenticated(false);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const response = await api.login(email, password);
      setUser(response.user);
      setIsAuthenticated(true);
      return response.user;
    } catch (err) {
      setIsAuthenticated(false);
      throw err;
    }
  }, []);

  const register = useCallback(
    async (email: string, password: string, full_name: string) => {
      await api.register(email, password, full_name);
      // Auto-login after registration
      return login(email, password);
    },
    [login]
  );

  const logout = useCallback(() => {
    api.logout();
    setUser(null);
    setIsAuthenticated(false);
  }, []);

  return {
    user,
    loading,
    isAuthenticated,
    login,
    register,
    logout,
  };
}

// ============================================================================
// USAGE EXAMPLES
// ============================================================================

/**
 * Example 1: Using API directly
 * 
 * const events = await api.getEvents();
 * const user = await api.getProfile();
 * 
 * Example 2: Using useApi hook
 * 
 * const { data: events, loading, error } = useApi(() => api.getEvents());
 * 
 * Example 3: Using useAuth hook in component
 * 
 * function LoginComponent() {
 *   const { login, isAuthenticated } = useAuth();
 *   
 *   const handleLogin = async (email, password) => {
 *     await login(email, password);
 *     navigate('/dashboard');
 *   };
 * }
 */

export type { User, Event, Ticket, BlogPost, AuthResponse };
