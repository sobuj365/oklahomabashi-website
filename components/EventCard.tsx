import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Event } from '../types';
import { api } from '../services/api';

interface Props {
  event: Event;
}

const EventCard: React.FC<Props> = ({ event }) => {
  const navigate = useNavigate();
  const [quantity, setQuantity] = useState(1);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [error, setError] = useState('');

  const handleGetTickets = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }
    setError('');
    setIsPurchasing(true);

    try {
      const response = await api.tickets.purchase(event.id, quantity);
      if (response?.url) {
        window.location.href = response.url;
      } else {
        setError('Unable to start checkout.');
      }
    } catch (err: any) {
      setError(err?.message || 'Ticket purchase failed.');
    } finally {
      setIsPurchasing(false);
    }
  };
  return (
    <motion.div
      whileHover={{ y: -10 }}
      className="glass-panel rounded-2xl overflow-hidden group relative"
    >
      <div className="h-48 overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-t from-okla-dark to-transparent z-10 opacity-60" />
        <img 
          src={event.image_url} 
          alt={event.title} 
          className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-700"
        />
        <div className="absolute top-4 right-4 z-20 bg-okla-600 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
          ${(event.price / 100).toFixed(2)}
        </div>
      </div>
      
      <div className="p-6 relative z-20">
        <div className="flex items-center text-sm text-okla-500 mb-2 font-mono">
          <span>{new Date(event.date * 1000).toLocaleDateString()}</span>
          <span className="mx-2">•</span>
          <span>{event.location}</span>
        </div>
        <h3 className="text-xl font-bold text-white mb-2 group-hover:text-okla-400 transition-colors">
          {event.title}
        </h3>
        <p className="text-gray-400 text-sm mb-4 line-clamp-2">
          {event.description}
        </p>
        <div className="flex items-center gap-3 mb-3">
          <label className="text-xs uppercase tracking-widest text-gray-400">Qty</label>
          <input
            type="number"
            min={1}
            max={20}
            value={quantity}
            onChange={(event) => setQuantity(Math.max(1, Math.min(20, Number(event.target.value))))}
            className="w-20 rounded-md bg-white/5 border border-white/10 px-3 py-2 text-white text-sm"
          />
          <span className="text-xs text-gray-500">Max 20</span>
        </div>
        {error && <div className="text-xs text-red-400 mb-3">{error}</div>}
        <button 
          onClick={handleGetTickets}
          disabled={isPurchasing}
          className="w-full py-3 bg-white/5 hover:bg-okla-600 border border-white/10 hover:border-okla-600 rounded-lg text-white font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <span>{isPurchasing ? 'Redirecting...' : 'Get Tickets'}</span>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </button>
      </div>
    </motion.div>
  );
};

export default EventCard;
