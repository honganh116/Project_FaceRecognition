import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navigation from './components/Navigation';
import CameraView from './pages/CameraView';
import AdminDashboard from './pages/AdminDashboard';

function App() {
  return (
    <Router>
      <div className="flex h-screen w-full bg-[#0a0b0d] text-[#f8fafc] overflow-hidden">
        <Navigation />
        <Routes>
          <Route path="/" element={<CameraView />} />
          <Route path="/admin" element={<AdminDashboard />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;