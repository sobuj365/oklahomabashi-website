import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { UserProfile, UserTicket } from '../types';

const emptyProfile: UserProfile = {
  id: '',
  email: '',
  full_name: '',
  role: 'user',
  phone: '',
  billing_address1: '',
  billing_address2: '',
  billing_city: '',
  billing_state: '',
  billing_zip: '',
  billing_country: ''
};

const formatMoney = (amount: number) => `$${(amount / 100).toLocaleString()}`;

const buildTicketHtml = (ticket: UserTicket) => {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Ticket ${ticket.id}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 32px; color: #0f172a; }
    .ticket { border: 1px solid #e2e8f0; border-radius: 16px; padding: 24px; max-width: 640px; }
    h1 { margin: 0 0 8px; font-size: 24px; }
    .meta { color: #64748b; margin-bottom: 16px; }
    .qr { margin-top: 16px; }
    .row { display: flex; justify-content: space-between; margin-bottom: 8px; }
    .label { font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; }
    .value { font-weight: 600; }
  </style>
</head>
<body>
  <div class="ticket">
    <h1>${ticket.title}</h1>
    <div class="meta">${new Date(ticket.date * 1000).toLocaleString()}</div>
    <div class="row"><div class="label">Location</div><div class="value">${ticket.location}</div></div>
    <div class="row"><div class="label">Status</div><div class="value">${ticket.status}</div></div>
    <div class="row"><div class="label">Price</div><div class="value">${formatMoney(ticket.price)}</div></div>
    <div class="qr">
      <img src="${ticket.qr_code}" alt="QR Code" width="240" height="240" />
    </div>
  </div>
</body>
</html>`;
};

const UserDashboard = () => {
  const [profile, setProfile] = useState<UserProfile>({ ...emptyProfile });
  const [tickets, setTickets] = useState<UserTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [profileData, ticketData] = await Promise.all([
        api.user.profile(),
        api.tickets.list()
      ]);
      setProfile(profileData);
      setTickets(ticketData);
    } catch (err: any) {
      setError(err?.message || 'Failed to load account data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setProfile((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      await api.user.updateProfile({
        full_name: profile.full_name,
        email: profile.email,
        phone: profile.phone,
        billing_address1: profile.billing_address1,
        billing_address2: profile.billing_address2,
        billing_city: profile.billing_city,
        billing_state: profile.billing_state,
        billing_zip: profile.billing_zip,
        billing_country: profile.billing_country
      });
      setSuccess('Profile updated successfully.');
    } catch (err: any) {
      setError(err?.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = (ticket: UserTicket) => {
    const newWindow = window.open('', '_blank', 'width=900,height=700');
    if (!newWindow) return;
    newWindow.document.write(buildTicketHtml(ticket));
    newWindow.document.close();
    newWindow.focus();
    newWindow.print();
  };

  if (loading) {
    return <div className="p-8 text-white">Loading your account...</div>;
  }

  return (
    <div className="min-h-screen bg-okla-dark pt-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-10">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-display font-bold text-white">My Account</h1>
          <button
            onClick={loadData}
            className="px-4 py-2 rounded-full border border-white/10 text-sm text-gray-200 hover:bg-white/10 transition"
          >
            Refresh
          </button>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-red-200">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-emerald-200">
            {success}
          </div>
        )}

        <div className="glass-panel p-8 rounded-xl">
          <h2 className="text-xl text-white font-bold mb-6">Profile & Billing</h2>
          <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col gap-2">
              <label className="text-sm text-gray-300">Full Name</label>
              <input
                name="full_name"
                value={profile.full_name || ''}
                onChange={handleChange}
                className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-white"
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm text-gray-300">Email</label>
              <input
                type="email"
                name="email"
                value={profile.email || ''}
                onChange={handleChange}
                className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-white"
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm text-gray-300">Phone</label>
              <input
                name="phone"
                value={profile.phone || ''}
                onChange={handleChange}
                className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-white"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm text-gray-300">Street Address</label>
              <input
                name="billing_address1"
                value={profile.billing_address1 || ''}
                onChange={handleChange}
                className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-white"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm text-gray-300">Apt / Suite</label>
              <input
                name="billing_address2"
                value={profile.billing_address2 || ''}
                onChange={handleChange}
                className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-white"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm text-gray-300">City</label>
              <input
                name="billing_city"
                value={profile.billing_city || ''}
                onChange={handleChange}
                className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-white"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm text-gray-300">State</label>
              <input
                name="billing_state"
                value={profile.billing_state || ''}
                onChange={handleChange}
                className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-white"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm text-gray-300">ZIP</label>
              <input
                name="billing_zip"
                value={profile.billing_zip || ''}
                onChange={handleChange}
                className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-white"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm text-gray-300">Country</label>
              <input
                name="billing_country"
                value={profile.billing_country || ''}
                onChange={handleChange}
                className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-white"
              />
            </div>
            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2 rounded-full bg-okla-600 hover:bg-okla-500 text-white font-semibold transition disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>

        <div className="glass-panel p-8 rounded-xl">
          <h2 className="text-xl text-white font-bold mb-6">Purchase History</h2>
          {tickets.length === 0 ? (
            <div className="text-gray-400">No ticket purchases yet.</div>
          ) : (
            <div className="space-y-4">
              {tickets.map((ticket) => (
                <div key={ticket.id} className="border border-white/10 rounded-xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <div className="text-white font-semibold">{ticket.title}</div>
                    <div className="text-gray-400 text-sm">{new Date(ticket.date * 1000).toLocaleString()}</div>
                    <div className="text-gray-500 text-sm">{ticket.location}</div>
                    <div className="text-gray-400 text-sm">Status: {ticket.status}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-white font-semibold">{formatMoney(ticket.price)}</div>
                    <button
                      onClick={() => handlePrint(ticket)}
                      className="px-4 py-2 rounded-full border border-white/20 text-white hover:bg-white/10"
                    >
                      Print / PDF
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserDashboard;
