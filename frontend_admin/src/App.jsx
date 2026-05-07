import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navigation from './components/Navigation';
import AdminDashboard from './pages/AdminDashboard';
// Xóa CameraView

function App() {
  return (
    <Router>
      <div className="flex h-screen w-full bg-[#0a0b0d] text-[#f8fafc] overflow-hidden">
        <Navigation />
        <Routes>
          {/* Trang chủ của Admin giờ là AdminDashboard */}
          <Route path="/" element={<AdminDashboard />} /> 
        </Routes>
      </div>
    </Router>
  );
}

export default App;