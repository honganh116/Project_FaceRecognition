import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Navigation from './components/Navigation';
import AdminDashboard from './pages/AdminDashboard';
import LoginPage from './pages/LoginPage';

function App() {
  const token = sessionStorage.getItem('token');

  return (
    // SỬA Ở DÒNG NÀY: Thêm basename="/admin"
    <Router basename="/admin"> 
      <div className="flex h-screen w-full bg-[#0a0b0d] text-[#f8fafc] overflow-hidden">
        {token && <Navigation />} 
        
        <Routes>
          <Route path="/login" element={token ? <Navigate to="/" /> : <LoginPage />} />
          <Route 
            path="/" 
            element={token ? <AdminDashboard /> : <Navigate to="/login" />} 
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App;