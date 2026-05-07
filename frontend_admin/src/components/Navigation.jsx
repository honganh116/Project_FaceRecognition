import React from 'react';
import { NavLink } from 'react-router-dom';
import { Users, Shield, Server, Database } from 'lucide-react';
import { cn } from '../lib/utils';

export default function Navigation() {
  return (
    <nav className="w-64 bg-[#000] border-r border-[#2d2d2d] flex flex-col h-screen text-[#64748b]">
      <div className="p-6 border-b border-[#2d2d2d] bg-[#15171c]">
        <div className="flex items-center gap-3">
          <Shield className="w-8 h-8 text-[#34d399]" />
          <h1 className="font-mono font-bold text-sm tracking-[2px] uppercase text-[#f8fafc]">FaceID Admin</h1>
        </div>
        <p className="text-[10px] uppercase font-mono tracking-widest text-[#64748b] mt-2">Quản trị Hệ thống</p>
      </div>

      <div className="flex-1 py-6 flex flex-col gap-2 px-4">
        {/* Route của Admin giờ đây là trang chủ "/" */}
        <NavLink to="/" className={({ isActive }) => cn("flex items-center gap-3 px-4 py-3 rounded-lg transition-colors font-medium text-sm", isActive ? "bg-blue-600/10 text-blue-400" : "hover:bg-slate-800 hover:text-white")}>
          <Users className="w-5 h-5" />
          Quản lý Nhân sự
        </NavLink>
      </div>

      <div className="p-4 border-t border-[#2d2d2d] text-[10px] font-mono uppercase tracking-wider">
        <h4 className="text-[#64748b] font-bold mb-3 border-b border-[#333] pb-2">Trạng thái Dịch vụ</h4>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between"><span className="flex items-center gap-2"><Server className="w-3 h-3 text-[#34d399]"/> FastAPI Backend</span><span className="w-2 h-2 rounded-full bg-[#34d399] shadow-[0_0_5px_rgba(52,211,153,0.5)]"></span></div>
          <div className="flex items-center justify-between"><span className="flex items-center gap-2"><Database className="w-3 h-3 text-[#34d399]"/> Database (SQLite)</span><span className="w-2 h-2 rounded-full bg-[#34d399] shadow-[0_0_5px_rgba(52,211,153,0.5)]"></span></div>
        </div>
      </div>
    </nav>
  );
}