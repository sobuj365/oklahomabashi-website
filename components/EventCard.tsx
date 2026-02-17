import React from 'react';
import { motion } from 'framer-motion';
import { Event } from '../types';

interface Props {
  event: Event;
}

const EventCard: React.FC<Props> = ({ event }) => {
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
        <button className="w-full py-3 bg-white/5 hover:bg-okla-600 border border-white/10 hover:border-okla-600 rounded-lg text-white font-semibold transition-all flex items-center justify-center gap-2">
          <span>Get Tickets</span>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </button>
      </div>
    </motion.div>
  );
};

export default EventCard;
