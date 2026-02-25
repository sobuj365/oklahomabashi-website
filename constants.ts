// API URL from environment variables or defaults
// For development: http://localhost:8787 (Cloudflare Worker local)
// For production: https://oklahomabashi-api.sobuj1.workers.dev
export const API_URL = import.meta.env.VITE_API_URL || 'https://oklahomabashi-api.sobuj1.workers.dev';

export const MOCK_EVENTS = [
  {
    id: '1',
    title: 'Pohela Boishakh 1431',
    description: 'Join us for the grand celebration of Bengali New Year with traditional food, music, and cultural performances.',
    date: 1713052800, // April 14, 2024
    location: 'Scissortail Park, OKC',
    price: 2500, // $25.00
    image_url: 'https://picsum.photos/800/600?random=1'
  },
  {
    id: '2',
    title: 'Edmond Cricket Tournament',
    description: 'Annual tape tennis cricket tournament. Register your team now!',
    date: 1715472000,
    location: 'Mitch Park, Edmond',
    price: 15000, // $150.00 per team
    image_url: 'https://picsum.photos/800/600?random=2'
  },
  {
    id: '3',
    title: 'Winter Pitha Utsab',
    description: 'Enjoy delicious winter cakes and cozy vibes with the community.',
    date: 1733011200,
    location: 'Community Hall, Norman',
    price: 1000,
    image_url: 'https://picsum.photos/800/600?random=3'
  }
];
