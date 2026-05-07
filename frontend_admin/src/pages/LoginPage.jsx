import React, { useState } from 'react';
import { Shield, Key, User, ArrowRight, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    // FastAPI yêu cầu dữ liệu gửi lên dưới dạng Form URL Encoded
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);

    try {
      const res = await fetch('http://localhost:8000/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData,
      });

      const data = await res.json();

      if (res.ok) {
        // Lưu token vào trình duyệt và tải lại trang
        localStorage.setItem('token', data.access_token);
        window.location.href = '/'; 
      } else {
        setError(data.detail || 'Đăng nhập thất bại');
      }
    } catch (err) {
      setError('Lỗi kết nối đến máy chủ!');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-full bg-[#0a0b0d] items-center justify-center font-mono">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="bg-[#15171c] p-10 rounded-2xl border border-[#2d2d2d] shadow-2xl w-full max-w-md relative overflow-hidden">
        
        {/* Hiệu ứng tia sáng trang trí */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#34d399] to-transparent opacity-50"></div>

        <div className="flex flex-col items-center mb-8">
          <div className="bg-[#34d399]/10 p-4 rounded-full mb-4">
            <Shield className="w-12 h-12 text-[#34d399]" />
          </div>
          <h1 className="text-white text-xl font-bold tracking-[4px] uppercase">FaceID Admin</h1>
          <p className="text-[#64748b] text-xs mt-2 uppercase tracking-widest">Khu vực hạn chế truy cập</p>
        </div>

        {error && (
          <div className="bg-[#f43f5e]/10 border border-[#f43f5e]/50 text-[#f43f5e] px-4 py-3 rounded-lg flex items-center gap-3 mb-6 text-sm">
            <AlertTriangle className="w-5 h-5" /> {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-xs uppercase text-[#64748b] mb-2 font-bold tracking-wider">Tài khoản</label>
            <div className="relative">
              <User className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-[#64748b]" />
              <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} required className="w-full bg-[#0a0b0d] border border-[#333] text-white px-10 py-3 rounded-lg outline-none focus:border-[#34d399] transition-colors" placeholder="Nhập admin..." />
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase text-[#64748b] mb-2 font-bold tracking-wider">Mật khẩu</label>
            <div className="relative">
              <Key className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-[#64748b]" />
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full bg-[#0a0b0d] border border-[#333] text-white px-10 py-3 rounded-lg outline-none focus:border-[#34d399] transition-colors" placeholder="••••••••" />
            </div>
          </div>

          <button type="submit" disabled={isLoading} className="w-full bg-[#34d399] text-black font-bold py-3 rounded-lg uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-[#2dbb86] transition-colors disabled:opacity-50">
            {isLoading ? 'Đang xác thực...' : <>Mở khóa hệ thống <ArrowRight className="w-5 h-5"/></>}
          </button>
        </form>
      </motion.div>
    </div>
  );
}