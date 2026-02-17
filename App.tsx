import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import AdminDashboard from './pages/AdminDashboard';

// Placeholder for sections in development
const PlaceholderPage = ({ title }: { title: string }) => (
  <div className="min-h-screen bg-okla-dark pt-32 px-4 flex flex-col items-center">
    <h1 className="text-4xl font-display font-bold text-white mb-4">{title}</h1>
    <p className="text-gray-400 max-w-lg text-center">
      This section is currently under development. Stay tuned for updates!
    </p>
  </div>
);

// Protected Route Wrapper
const ProtectedRoute = ({ children, role }: { children: React.ReactNode, role?: string }) => {
  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;

  // If no token or invalid user data, redirect to login
  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  // If a specific role is required, check if user has that role
  if (role && user?.role !== role) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

function App() {
  return (
    <HashRouter>
      <div className="min-h-screen bg-okla-dark text-white selection:bg-okla-500 selection:text-white">
        <Navbar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/events" element={<Home />} /> {/* Reuse Home for events listing for now */}
          <Route path="/blog" element={<PlaceholderPage title="Community Blog" />} />
          <Route path="/about" element={<PlaceholderPage title="About Us" />} />
          <Route path="/donate" element={<PlaceholderPage title="Make a Donation" />} />
          
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute role="admin">
                <AdminDashboard />
              </ProtectedRoute>
            } 
          />
          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        
        <footer className="bg-black/50 backdrop-blur-md py-12 border-t border-white/10 mt-20">
            <div className="max-w-7xl mx-auto px-6 text-center text-gray-500 text-sm">
                <p>&copy; {new Date().getFullYear()} OKLAHOMABASHI. All rights reserved.</p>
                <p className="mt-2">Built for the Community.</p>
            </div>
        </footer>
      </div>
    </HashRouter>
  );
}

export default App;