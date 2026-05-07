import React, { useState, useEffect } from 'react';
import { UserPlus, Save, CheckCircle2, Clock } from 'lucide-react';
import { motion } from 'framer-motion';

export default function AdminDashboard() {
  const [logs, setLogs] = useState([]);
  const [isAdding, setIsAdding] = useState(false);
  const [addingStatus, setAddingStatus] = useState("idle"); // idle | saving | done | error
  const [formData, setFormData] = useState({ name: '', student_code: '' });
  const [photo, setPhoto] = useState(null);

  // Lấy lịch sử từ API thật của nhóm
const fetchLogs = async () => {
    try {
      const token = localStorage.getItem('token'); // Lấy chìa khóa
      const res = await fetch('http://localhost:8000/api/logs', {
        headers: {
          'Authorization': `Bearer ${token}` // Đính kèm chìa khóa
        }
      });
      
      // Nếu token hết hạn (mã 401), văng ra log in lại
      if (res.status === 401) {
        localStorage.removeItem('token');
        window.location.href = '/login';
        return;
      }
      
      const data = await res.json();
      setLogs(data.data || []);
    } catch (error) {
      console.error("Lỗi lấy dữ liệu:", error);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  // Gọi API Đăng ký thật
 const handleSubmit = async (e) => {
    e.preventDefault();
    if (!photo) return alert("Vui lòng chọn ảnh!");
    
    setAddingStatus("saving");
    const data = new FormData();
    data.append('name', formData.name);
    data.append('student_code', formData.student_code);
    data.append('file', photo);

    try {
      const res = await fetch('http://localhost:8000/api/register', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: data // Đính kèm dữ liệu (Tên, Mã SV, Ảnh) vào đây
      });
      const result = await res.json();

      if (result.error) {
        alert(result.error);
        setAddingStatus("error");
      } else {
        setAddingStatus("done");
        setTimeout(() => {
          setIsAdding(false);
          setAddingStatus("idle");
          setFormData({ name: '', student_code: '' });
          setPhoto(null);
          fetchLogs(); // Load lại bảng
        }, 2000);
      }
    } catch (error) {
      alert("Lỗi kết nối Server!");
      setAddingStatus("error");
    }
  };

  return (
    <div className="flex-1 bg-[#0a0b0d] text-slate-300 overflow-y-auto font-sans p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8 border-b border-[#2d2d2d] pb-6">
          <div>
            <h1 className="text-sm font-mono tracking-[2px] font-bold text-[#f8fafc] uppercase">Quản trị Hệ thống FaceID</h1>
            <p className="text-[#64748b] font-mono text-[10px] uppercase tracking-wider mt-2">Danh sách điểm danh & Đăng ký sinh viên.</p>
          </div>
          <button onClick={() => setIsAdding(!isAdding)} className="bg-[#34d399] text-black px-4 py-2 flex items-center gap-2 rounded-sm font-mono text-xs font-bold uppercase hover:bg-[#2dbb86]">
             <UserPlus className="w-5 h-5"/> Thêm nhân sự
          </button>
        </div>

        {isAdding && (
           <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="bg-[#15171c] border border-[#2d2d2d] p-6 mb-8">
              <h2 className="text-[10px] text-[#64748b] font-mono uppercase mb-6 border-b border-[#333] pb-2">Đăng ký khuôn mặt mới</h2>
              <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-[#64748b] mb-2">Mã Sinh Viên</label>
                    <input required value={formData.student_code} onChange={e => setFormData({...formData, student_code: e.target.value})} className="w-full border-[#333] border bg-[#000] text-white px-3 py-2 outline-none font-mono text-sm" placeholder="VD: 24022255" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-[#64748b] mb-2">Họ và Tên</label>
                    <input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full border-[#333] border bg-[#000] text-white px-3 py-2 outline-none text-sm" placeholder="Nguyễn Văn A" />
                  </div>
                </div>

                <div className="space-y-4">
                   <div>
                     <label className="block text-[10px] font-mono uppercase text-[#64748b] mb-2">Tải lên ảnh nhận diện</label>
                     <div className="border border-dashed border-[#333] p-8 text-center bg-[#0a0b0d] relative cursor-pointer hover:border-[#34d399]">
                        <input type="file" required accept="image/*" onChange={(e) => setPhoto(e.target.files[0])} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                        {photo ? <div className="text-[#34d399] font-mono text-xs">{photo.name}</div> : <span className="text-[#64748b] font-mono text-[10px]">Click hoặc Kéo thả ảnh (File JPEG/PNG)</span>}
                     </div>
                   </div>

                   <button type="submit" disabled={addingStatus !== "idle"} className="w-full bg-[#1c1f26] border border-[#333] text-white py-3 flex items-center justify-center gap-2 font-mono text-xs uppercase font-bold hover:bg-[#2d2f36] disabled:opacity-50">
                     {addingStatus === "idle" && <><Save className="w-4 h-4"/> Đăng ký khuôn mặt</>}
                     {addingStatus === "saving" && <><Clock className="w-4 h-4 animate-spin"/> Đang xử lý AI...</>}
                     {addingStatus === "done" && <><CheckCircle2 className="w-4 h-4 text-[#34d399]" /> Đăng ký thành công!</>}
                   </button>
                </div>
              </form>
           </motion.div>
        )}

        <div className="bg-[#15171c] border border-[#2d2d2d] overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#0a0b0d] text-[#64748b] border-b border-[#333] font-mono text-[10px] uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3 font-normal">Họ và Tên</th>
                <th className="px-6 py-3 font-normal">Mã Sinh Viên</th>
                <th className="px-6 py-3 font-normal">Thời gian nhận diện</th>
              </tr>
            </thead>
            <tbody className="font-sans text-xs">
              {logs.map((log, i) => (
                <tr key={i} className="border-b border-[#2d2d2d] hover:bg-[#1c1f26]">
                  <td className="px-6 py-4 text-[#f8fafc]">{log.name}</td>
                  <td className="px-6 py-4 text-[#34d399] font-mono font-bold tracking-wider">{log.student_code}</td>
                  <td className="px-6 py-4 text-[#64748b] font-mono text-[10px]">{log.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}