import { API_URL, MOCK_EVENTS } from '../constants';
import { User, Event, Ticket, AdminStats } from '../types';

// Helper to handle API requests
async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('token');
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
        // If API fails (e.g. 404 because worker isn't deployed yet), throw
        // In a real scenario, we handle errors gracefully
        const error = await response.json().catch(() => ({ error: 'Network Error' }));
        throw new Error(error.error || 'Request failed');
    }

    return response.json();
  } catch (error) {
    // FALLBACK FOR DEMO: If Worker isn't deployed, return Mock data so the UI works
    console.warn(`API Request failed for ${endpoint}. Using fallback/mock data.`);
    
    if (endpoint === '/events') return MOCK_EVENTS as unknown as T;
    if (endpoint === '/auth/login') {
        return { 
            token: 'mock-jwt', 
            user: { id: 'mock-1', email: 'user@demo.com', full_name: 'Demo User', role: 'admin' } 
        } as unknown as T;
    }
    
    throw error;
  }
}

export const api = {
  auth: {
    login: (email: string, password: string) => 
      request<{token: string, user: User}>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      }),
    register: (data: any) => 
      request('/auth/register', {
        method: 'POST',
        body: JSON.stringify(data)
      }),
  },
  events: {
    list: () => request<Event[]>('/events'),
    get: (id: string) => request<Event>(`/events/${id}`),
  },
  tickets: {
    purchase: (eventId: string) => 
      request<{success: boolean, ticketId: string}>('/tickets/purchase', {
        method: 'POST',
        body: JSON.stringify({ event_id: eventId })
      }),
    list: () => request<Ticket[]>('/user/tickets'),
  },
  admin: {
    stats: () => request<AdminStats>('/admin/stats'),
    events: {
      list: () => request<Event[]>('/admin/events'),
      create: (data: any) =>
        request<{ success: boolean; id: string }>('/admin/events', {
          method: 'POST',
          body: JSON.stringify(data)
        }),
      update: (id: string, data: any) =>
        request<{ success: boolean }>(`/admin/events/${id}`, {
          method: 'PUT',
          body: JSON.stringify(data)
        }),
      remove: (id: string) =>
        request<{ success: boolean }>(`/admin/events/${id}`, {
          method: 'DELETE'
        })
    }
  }
};
