import React, { useState } from 'react';
import {
  Search,
  UserCheck,
  Clock,
  AlertTriangle,
  Calendar,
  Briefcase,
  CheckCircle2,
  LogOut,
  LogIn,
} from 'lucide-react';
import { motion } from 'framer-motion';

export default function PortalPage() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [profile, setProfile] = useState(null);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    setError('');
    setProfile(null);

    try {
      const res = await fetch(`/api/lookup/${encodeURIComponent(code.trim())}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || 'Không tìm thấy thông tin nhân sự!');
      } else {
        setProfile(data);
      }
    } catch (err) {
      setError('Không thể kết nối tới máy chủ!');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 bg-[#0a0b0d] text-slate-200 overflow-y-auto p-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="border-b border-[#2d2d2d] pb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-lg font-mono tracking-[2px] font-bold text-white uppercase flex items-center gap-2">
              <UserCheck className="w-6 h-6 text-[#34d399]" />
              Cổng Tra Cứu Cá Nhân (Self-Service App)
            </h1>
            <p className="text-[#64748b] font-mono text-xs uppercase tracking-wider mt-1">
              Tra cứu bảng công, giờ vào/tan ca & tổng số giờ làm việc theo Mã Nhân Sự / Sinh Viên.
            </p>
          </div>
        </div>

        <form onSubmit={handleSearch} className="flex gap-3">
          <div className="relative flex-1">
            <Search className="w-5 h-5 text-[#64748b] absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Nhập Mã Sinh Viên / Nhân Sự của bạn (VD: 24022255)..."
              className="w-full bg-[#15171c] border border-[#2d2d2d] focus:border-[#34d399] rounded-lg pl-12 pr-4 py-3.5 text-white font-mono text-sm outline-none transition-colors"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="bg-[#34d399] hover:bg-[#2dbb86] text-black font-mono font-bold text-xs uppercase tracking-wider px-8 py-3.5 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
          >
            {loading ? 'Đang tra cứu...' : 'Tra cứu ngay'}
          </button>
        </form>

        {error && (
          <div className="bg-[#f43f5e]/10 border border-[#f43f5e]/40 text-[#f43f5e] p-4 rounded-lg font-mono text-xs flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {profile && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Thẻ Hồ sơ Nhân sự */}
            <div className="bg-[#15171c] border border-[#2d2d2d] rounded-xl p-6 flex flex-col md:flex-row items-center gap-6">
              <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-[#34d399] bg-[#0a0b0d] shrink-0">
                <img
                  src={profile.image_url}
                  alt={profile.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
              <div className="flex-1 text-center md:text-left">
                <span className="bg-[#34d399]/15 text-[#34d399] border border-[#34d399]/30 font-mono text-[10px] px-2.5 py-0.5 rounded uppercase">
                  Đã xác thực Sinh trắc học ArcFace 512D
                </span>
                <h2 className="text-2xl font-bold text-white mt-2">{profile.name}</h2>
                <p className="font-mono text-sm text-[#38bdf8] mt-1">
                  Mã định danh: {profile.student_code}
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full md:w-auto">
                <div className="bg-[#0a0b0d] border border-[#2d2d2d] p-3.5 rounded-lg text-center">
                  <CheckCircle2 className="w-4 h-4 text-[#34d399] mx-auto mb-1" />
                  <span className="block font-mono text-lg font-bold text-white">
                    {profile.stats?.on_time_count || 0}
                  </span>
                  <span className="font-mono text-[10px] text-[#64748b] uppercase">Đúng giờ</span>
                </div>
                <div className="bg-[#0a0b0d] border border-[#2d2d2d] p-3.5 rounded-lg text-center">
                  <Clock className="w-4 h-4 text-[#f43f5e] mx-auto mb-1" />
                  <span className="block font-mono text-lg font-bold text-[#f43f5e]">
                    {profile.stats?.late_count || 0}
                  </span>
                  <span className="font-mono text-[10px] text-[#64748b] uppercase">Đi muộn</span>
                </div>
                <div className="bg-[#0a0b0d] border border-[#2d2d2d] p-3.5 rounded-lg text-center">
                  <Briefcase className="w-4 h-4 text-[#38bdf8] mx-auto mb-1" />
                  <span className="block font-mono text-lg font-bold text-[#38bdf8]">
                    {profile.stats?.total_work_hours || 0}h
                  </span>
                  <span className="font-mono text-[10px] text-[#64748b] uppercase">Giờ làm</span>
                </div>
                <div className="bg-[#0a0b0d] border border-[#2d2d2d] p-3.5 rounded-lg text-center">
                  <Calendar className="w-4 h-4 text-[#eab308] mx-auto mb-1" />
                  <span className="block font-mono text-lg font-bold text-white">
                    {profile.stats?.total_scans || 0}
                  </span>
                  <span className="font-mono text-[10px] text-[#64748b] uppercase">Tổng lượt</span>
                </div>
              </div>
            </div>

            {/* Lịch sử Check-in / Check-out gần đây */}
            <div className="bg-[#15171c] border border-[#2d2d2d] rounded-xl overflow-hidden">
              <div className="px-6 py-4 bg-[#1c1f26] border-b border-[#333] flex items-center justify-between">
                <span className="font-mono text-xs font-bold uppercase text-white tracking-wider">
                  Nhật ký Check-in / Check-out Gần Đây
                </span>
                <span className="font-mono text-[10px] text-[#64748b] uppercase">
                  Tối đa 20 lượt gần nhất
                </span>
              </div>
              <table className="w-full text-left text-xs">
                <thead className="bg-[#0a0b0d] text-[#64748b] font-mono text-[10px] uppercase border-b border-[#2d2d2d]">
                  <tr>
                    <th className="px-6 py-3">Thời gian</th>
                    <th className="px-6 py-3">Phân loại</th>
                    <th className="px-6 py-3">Trạng thái</th>
                    <th className="px-6 py-3 text-right">Giờ làm tích lũy</th>
                  </tr>
                </thead>
                <tbody className="font-mono">
                  {(profile.recent_logs || []).map((item, idx) => (
                    <tr
                      key={idx}
                      className="border-b border-[#2d2d2d] hover:bg-[#1c1f26] transition-colors"
                    >
                      <td className="px-6 py-3.5 text-slate-200">{item.time}</td>
                      <td className="px-6 py-3.5">
                        {item.check_type === 'Check-out' ? (
                          <span className="inline-flex items-center gap-1.5 text-[#38bdf8] bg-[#38bdf8]/10 border border-[#38bdf8]/30 px-2.5 py-1 rounded text-[10px] font-bold uppercase">
                            <LogOut className="w-3 h-3" /> Check-out
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-[#34d399] bg-[#34d399]/10 border border-[#34d399]/30 px-2.5 py-1 rounded text-[10px] font-bold uppercase">
                            <LogIn className="w-3 h-3" /> Check-in
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-3.5">
                        <span
                          className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase ${
                            item.status === 'Đi muộn'
                              ? 'text-[#f43f5e] bg-[#f43f5e]/10'
                              : item.status === 'Tan ca'
                              ? 'text-[#38bdf8] bg-[#38bdf8]/10'
                              : 'text-[#34d399] bg-[#34d399]/10'
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-right text-slate-300 font-bold">
                        {item.work_hours > 0 ? `${item.work_hours} giờ` : '-'}
                      </td>
                    </tr>
                  ))}
                  {(!profile.recent_logs || profile.recent_logs.length === 0) && (
                    <tr>
                      <td colSpan="4" className="px-6 py-8 text-center text-[#64748b] uppercase">
                        Chưa có lượt chấm công nào.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
