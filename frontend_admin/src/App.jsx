import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Navigation from './components/Navigation';
import AdminDashboard from './pages/AdminDashboard';
import LoginPage from './pages/LoginPage'; // <--- CHÍNH LÀ DÒNG NÀY ĐÂY!

function App() {
  // Kiểm tra xem trình duyệt đã giữ chìa khóa (token) chưa
  const token = localStorage.getItem('token');

  return (
    <Router>
      <div className="flex h-screen w-full bg-[#0a0b0d] text-[#f8fafc] overflow-hidden">
        {/* Chỉ hiện thanh Menu bên trái nếu đã đăng nhập */}
        {token && <Navigation />} 
        
        <Routes>
          <Route path="/login" element={token ? <Navigate to="/" /> : <LoginPage />} />
          
          {/* Nếu chưa có token, đá văng về trang /login */}
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