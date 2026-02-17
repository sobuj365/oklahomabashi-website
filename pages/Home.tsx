import React, { useEffect, useState } from 'react';
import Hero3D from '../components/Hero3D';
import EventCard from '../components/EventCard';
import { api } from '../services/api';
import { Event } from '../types';

const Home = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.events.list()
      .then(setEvents)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-okla-dark">
      <Hero3D />
      
      {/* Featured Events */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="flex justify-between items-end mb-12">
          <div>
            <h2 className="text-4xl font-display font-bold text-white mb-2">Upcoming <span className="text-okla-500">Events</span></h2>
            <p className="text-gray-400">Join the vibrant Bangladeshi community in Oklahoma.</p>
          </div>
          <button className="text-okla-500 hover:text-white font-medium transition-colors">View All &rarr;</button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20 text-okla-500">Loading events...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {events.map(event => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </section>

      {/* Stats Section */}
      <section className="py-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-okla-900/20 backdrop-blur-3xl" />
        <div className="max-w-7xl mx-auto px-4 relative z-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { label: 'Active Members', value: '2.5k+' },
              { label: 'Events Hosted', value: '150+' },
              { label: 'Donations Raised', value: '$50k+' },
              { label: 'Volunteers', value: '300+' },
            ].map((stat, i) => (
              <div key={i} className="glass-panel p-8 rounded-xl">
                <div className="text-4xl font-bold text-white mb-2 font-display">{stat.value}</div>
                <div className="text-sm text-okla-400 uppercase tracking-widest">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
