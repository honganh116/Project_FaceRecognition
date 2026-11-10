import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Users,
  Shield,
  Server,
  Database,
  Download,
  LogOut,
  Camera,
} from 'lucide-react';
import { cn } from '../lib/utils';

export default function Navigation() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallApp = async () => {
    if (!deferredPrompt) {
      alert(
        'Ứng dụng Quản trị đã hỗ trợ PWA! Bạn có thể bấm biểu tượng Cài đặt trên thanh địa chỉ trình duyệt để đưa ra Desktop / Màn hình chính.'
      );
      return;
    }
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  };

  const handleLogout = () => {
    sessionStorage.removeItem('token');
    window.location.href = '/admin/login';
  };

  return (
    <nav className="w-64 bg-[#000] border-r border-[#2d2d2d] flex flex-col h-screen text-[#64748b] shrink-0">
      <div className="p-6 border-b border-[#2d2d2d] bg-[#15171c]">
        <div className="flex items-center gap-3">
          <Shield className="w-8 h-8 text-[#34d399]" />
          <div>
            <h1 className="font-mono font-bold text-sm tracking-[2px] uppercase text-[#f8fafc]">
              FaceID Admin
            </h1>
            <span className="text-[9px] font-mono bg-[#38bdf8]/15 text-[#38bdf8] px-1.5 py-0.5 rounded uppercase">
              Enterprise v3.0
            </span>
          </div>
        </div>
        <p className="text-[10px] uppercase font-mono tracking-widest text-[#64748b] mt-2">
          Quản trị Hệ thống
        </p>
      </div>

      <div className="flex-1 py-6 flex flex-col gap-2 px-4">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors font-mono text-xs uppercase tracking-wider font-bold',
              isActive
                ? 'bg-[#34d399]/15 text-[#34d399] border border-[#34d399]/30'
                : 'hover:bg-[#15171c] hover:text-white'
            )
          }
        >
          <Users className="w-4 h-4" />
          Bảng Điều Khiển
        </NavLink>

        <a
          href="/"
          className="flex items-center gap-3 px-4 py-3 rounded-lg transition-colors font-mono text-xs uppercase tracking-wider hover:bg-[#15171c] hover:text-white mt-2 border-t border-[#1e2028] pt-4"
        >
          <Camera className="w-4 h-4 text-[#38bdf8]" />
          Mở Kiosk Quét Mặt
        </a>
      </div>

      <div className="px-4 pb-4 space-y-2">
        <button
          onClick={handleInstallApp}
          className="w-full bg-[#34d399]/10 hover:bg-[#34d399]/20 border border-[#34d399]/40 text-[#34d399] px-3 py-2.5 rounded-lg font-mono text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          Cài Đặt App Admin
        </button>

        <button
          onClick={handleLogout}
          className="w-full bg-[#f43f5e]/10 hover:bg-[#f43f5e]/20 border border-[#f43f5e]/30 text-[#f43f5e] px-3 py-2.5 rounded-lg font-mono text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          Đăng Xuất
        </button>
      </div>

      <div className="p-4 border-t border-[#2d2d2d] text-[10px] font-mono uppercase tracking-wider">
        <h4 className="text-[#64748b] font-bold mb-3 border-b border-[#333] pb-2">
          Trạng thái Dịch vụ
        </h4>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Server className="w-3 h-3 text-[#34d399]" /> ArcFace + RQ Worker
            </span>
            <span className="w-2 h-2 rounded-full bg-[#34d399] shadow-[0_0_5px_rgba(52,211,153,0.5)]"></span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Database className="w-3 h-3 text-[#34d399]" /> Qdrant + Postgres + MinIO
            </span>
            <span className="w-2 h-2 rounded-full bg-[#34d399] shadow-[0_0_5px_rgba(52,211,153,0.5)]"></span>
          </div>
        </div>
      </div>
    </nav>
  );
}
