import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';
import { AdminStats, Event } from '../types';

const emptyForm = {
  title: '',
  description: '',
  date: '',
  location: '',
  price: '',
  capacity: '',
  category: 'cultural',
  status: 'active',
  image_url: ''
};

const categoryOptions = ['cultural', 'sports', 'educational', 'charity', 'community'];
const statusOptions = ['active', 'draft', 'cancelled', 'archived'];

const toDateTimeLocal = (unixSeconds: number) => {
  const date = new Date(unixSeconds * 1000);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const AdminDashboard = () => {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });

  const loadDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsData, eventData] = await Promise.all([
        api.admin.stats(),
        api.admin.events.list()
      ]);
      setStats(statsData);
      setEvents(eventData);
    } catch (err: any) {
      setError(err?.message || 'Failed to load admin data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const resetForm = () => {
    setForm({ ...emptyForm });
    setEditingId(null);
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setError('Image is too large. Please upload a file under 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        setForm((prev) => ({ ...prev, image_url: reader.result }));
      }
    };
    reader.readAsDataURL(file);
  };

  const buildPayload = () => {
    const priceValue = Number(form.price);
    const capacityValue = form.capacity ? Number(form.capacity) : null;
    const dateValue = form.date ? Math.floor(new Date(form.date).getTime() / 1000) : null;

    if (!form.title || !form.location || !form.date) {
      throw new Error('Title, date, and location are required.');
    }

    if (Number.isNaN(priceValue) || priceValue < 0) {
      throw new Error('Price must be a valid number.');
    }

    if (capacityValue !== null && (Number.isNaN(capacityValue) || capacityValue < 0)) {
      throw new Error('Capacity must be a valid number.');
    }

    if (!dateValue) {
      throw new Error('Date is required.');
    }

    return {
      title: form.title.trim(),
      description: form.description.trim(),
      date: dateValue,
      location: form.location.trim(),
      price: Math.round(priceValue * 100),
      capacity: capacityValue,
      category: form.category,
      status: form.status,
      image_url: form.image_url.trim()
    };
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const payload = buildPayload();

      if (editingId) {
        await api.admin.events.update(editingId, payload);
      } else {
        await api.admin.events.create(payload);
      }

      resetForm();
      await loadDashboard();
    } catch (err: any) {
      setError(err?.message || 'Failed to save event.');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (event: Event) => {
    setEditingId(event.id);
    setForm({
      title: event.title || '',
      description: event.description || '',
      date: event.date ? toDateTimeLocal(event.date) : '',
      location: event.location || '',
      price: event.price ? (event.price / 100).toString() : '0',
      capacity: event.capacity !== undefined && event.capacity !== null ? String(event.capacity) : '',
      category: event.category || 'cultural',
      status: event.status || 'active',
      image_url: event.image_url || ''
    });
  };

  const handleCancel = async (eventId: string) => {
    if (!window.confirm('Cancel this event? It will no longer be active.')) return;
    setSaving(true);
    try {
      const event = events.find((item) => item.id === eventId);
      if (!event) return;
      await api.admin.events.update(eventId, {
        title: event.title,
        description: event.description || '',
        date: event.date,
        location: event.location,
        price: event.price || 0,
        image_url: event.image_url || '',
        capacity: event.capacity ?? null,
        category: event.category || 'cultural',
        status: 'cancelled'
      });
      await loadDashboard();
    } catch (err: any) {
      setError(err?.message || 'Failed to cancel event.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (eventId: string) => {
    if (!window.confirm('Archive this event? It will be hidden from the public list.')) return;
    setSaving(true);
    try {
      await api.admin.events.remove(eventId);
      await loadDashboard();
    } catch (err: any) {
      setError(err?.message || 'Failed to archive event.');
    } finally {
      setSaving(false);
    }
  };

  const statsCards = useMemo(() => {
    if (!stats) return [];
    return [
      { label: 'Total Revenue', value: `$${(stats.revenue / 100).toLocaleString()}`, color: 'border-okla-500' },
      { label: 'Tickets Sold', value: stats.tickets.toLocaleString(), color: 'border-blue-500' },
      { label: 'Total Users', value: stats.users.toLocaleString(), color: 'border-purple-500' }
    ];
  }, [stats]);

  if (loading) {
    return <div className="p-8 text-white">Loading Dashboard...</div>;
  }

  return (
    <div className="min-h-screen bg-okla-dark pt-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <h1 className="text-3xl font-display font-bold text-white">Admin Dashboard</h1>
          <button
            onClick={loadDashboard}
            className="px-4 py-2 rounded-full border border-white/10 text-sm text-gray-200 hover:bg-white/10 transition"
          >
            Refresh Data
          </button>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-red-200">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {statsCards.map((card) => (
            <div key={card.label} className={`glass-panel p-6 rounded-xl border-l-4 ${card.color}`}>
              <h3 className="text-gray-400 text-sm uppercase font-bold tracking-wider mb-2">{card.label}</h3>
              <p className="text-3xl text-white font-mono">{card.value}</p>
            </div>
          ))}
        </div>

        <div className="glass-panel p-8 rounded-xl mb-12">
          <h2 className="text-xl text-white font-bold mb-6">{editingId ? 'Edit Event' : 'Create Event'}</h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col gap-2">
              <label className="text-sm text-gray-300">Title</label>
              <input
                name="title"
                value={form.title}
                onChange={handleInputChange}
                className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-white"
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm text-gray-300">Date & Time</label>
              <input
                type="datetime-local"
                name="date"
                value={form.date}
                onChange={handleInputChange}
                className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-white"
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm text-gray-300">Location</label>
              <input
                name="location"
                value={form.location}
                onChange={handleInputChange}
                className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-white"
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm text-gray-300">Price (USD)</label>
              <input
                type="number"
                name="price"
                min="0"
                step="0.01"
                value={form.price}
                onChange={handleInputChange}
                className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-white"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm text-gray-300">Ticket Capacity</label>
              <input
                type="number"
                name="capacity"
                min="0"
                value={form.capacity}
                onChange={handleInputChange}
                className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-white"
                placeholder="Optional"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm text-gray-300">Category</label>
              <select
                name="category"
                value={form.category}
                onChange={handleInputChange}
                className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-white"
              >
                {categoryOptions.map((option) => (
                  <option key={option} value={option} className="text-black">
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm text-gray-300">Status</label>
              <select
                name="status"
                value={form.status}
                onChange={handleInputChange}
                className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-white"
              >
                {statusOptions.map((option) => (
                  <option key={option} value={option} className="text-black">
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2 flex flex-col gap-2">
              <label className="text-sm text-gray-300">Description</label>
              <textarea
                name="description"
                value={form.description}
                onChange={handleInputChange}
                className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-white min-h-[120px]"
              />
            </div>
            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-sm text-gray-300">Image URL</label>
                <input
                  name="image_url"
                  value={form.image_url}
                  onChange={handleInputChange}
                  className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-white"
                  placeholder="https://..."
                />
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="text-sm text-gray-300"
                />
                <p className="text-xs text-gray-500">Uploads are stored as data URLs. Keep images under 2MB.</p>
              </div>
              <div className="flex flex-col gap-2">
                {form.image_url ? (
                  <div className="relative">
                    <img src={form.image_url} alt="Event preview" className="rounded-lg max-h-40 object-cover" />
                    <button
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, image_url: '' }))}
                      className="absolute top-2 right-2 bg-black/60 text-white text-xs px-3 py-1 rounded-full"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-white/20 p-6 text-center text-sm text-gray-500">
                    No image selected
                  </div>
                )}
              </div>
            </div>
            <div className="md:col-span-2 flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2 rounded-full bg-okla-600 hover:bg-okla-500 text-white font-semibold transition disabled:opacity-50"
              >
                {saving ? 'Saving...' : editingId ? 'Update Event' : 'Create Event'}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-6 py-2 rounded-full border border-white/20 text-white hover:bg-white/10 transition"
                >
                  Cancel Edit
                </button>
              )}
            </div>
          </form>
        </div>

        <div className="glass-panel p-8 rounded-xl mb-12">
          <h2 className="text-xl text-white font-bold mb-6">Event Management</h2>
          {events.length === 0 ? (
            <div className="text-gray-400">No events found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm text-gray-300">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-gray-500">
                    <th className="py-3">Event</th>
                    <th className="py-3">Status</th>
                    <th className="py-3">Tickets</th>
                    <th className="py-3">Revenue</th>
                    <th className="py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {events.map((event) => {
                    const ticketsSold = event.tickets_sold ?? 0;
                    const revenue = event.revenue ?? event.price * ticketsSold;
                    return (
                      <tr key={event.id} className="align-top">
                        <td className="py-4 pr-4">
                          <div className="text-white font-semibold">{event.title}</div>
                          <div className="text-gray-400">{new Date(event.date * 1000).toLocaleString()}</div>
                          <div className="text-gray-500">{event.location}</div>
                        </td>
                        <td className="py-4 pr-4">
                          <span className="px-2 py-1 rounded-full text-xs bg-white/10">
                            {event.status || 'active'}
                          </span>
                        </td>
                        <td className="py-4 pr-4">{ticketsSold.toLocaleString()}</td>
                        <td className="py-4 pr-4">${(revenue / 100).toLocaleString()}</td>
                        <td className="py-4">
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() => handleEdit(event)}
                              className="px-3 py-1 rounded-full border border-white/20 text-white hover:bg-white/10"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleCancel(event.id)}
                              className="px-3 py-1 rounded-full border border-yellow-500/40 text-yellow-200 hover:bg-yellow-500/20"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleDelete(event.id)}
                              className="px-3 py-1 rounded-full border border-red-500/40 text-red-200 hover:bg-red-500/20"
                            >
                              Archive
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
