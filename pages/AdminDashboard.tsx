import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { api } from '../services/api';

const AdminDashboard = () => {
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    // In a real app, this would fetch from the worker
    // Using mock data here for the UI visualization because worker might not be deployed
    setStats({
      users: 1240,
      tickets: 850,
      revenue: 4500000 // cents
    });
  }, []);

  const data = [
    { name: 'Jan', tickets: 40 },
    { name: 'Feb', tickets: 30 },
    { name: 'Mar', tickets: 20 },
    { name: 'Apr', tickets: 278 }, // Pohela Boishakh spike
    { name: 'May', tickets: 189 },
  ];

  if (!stats) return <div className="p-8 text-white">Loading Dashboard...</div>;

  return (
    <div className="min-h-screen bg-okla-dark pt-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-display font-bold text-white mb-8">Admin Dashboard</h1>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="glass-panel p-6 rounded-xl border-l-4 border-okla-500">
            <h3 className="text-gray-400 text-sm uppercase font-bold tracking-wider mb-2">Total Revenue</h3>
            <p className="text-3xl text-white font-mono">${(stats.revenue / 100).toLocaleString()}</p>
          </div>
          <div className="glass-panel p-6 rounded-xl border-l-4 border-blue-500">
            <h3 className="text-gray-400 text-sm uppercase font-bold tracking-wider mb-2">Tickets Sold</h3>
            <p className="text-3xl text-white font-mono">{stats.tickets}</p>
          </div>
          <div className="glass-panel p-6 rounded-xl border-l-4 border-purple-500">
            <h3 className="text-gray-400 text-sm uppercase font-bold tracking-wider mb-2">Total Users</h3>
            <p className="text-3xl text-white font-mono">{stats.users}</p>
          </div>
        </div>

        {/* Chart Section */}
        <div className="glass-panel p-8 rounded-xl mb-12">
          <h3 className="text-xl text-white font-bold mb-6">Ticket Sales Trend</h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="name" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
                />
                <Bar dataKey="tickets" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
