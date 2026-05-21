import React, { useState, useEffect } from 'react';
import { UserPlus, Save, CheckCircle2, Clock, Trash2, List, Database, Calendar, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('logs'); 
  
  const [logs, setLogs] = useState([]);
  const [users, setUsers] = useState([]); 
  
  const [isAdding, setIsAdding] = useState(false);
  const [addingStatus, setAddingStatus] = useState("idle"); 
  const [formData, setFormData] = useState({ name: '', student_code: '' });
  const [photo, setPhoto] = useState(null);
  
  const [shiftTime, setShiftTime] = useState(localStorage.getItem('shiftTime') || '08:00');

  const handleShiftTimeChange = (e) => {
    const newTime = e.target.value;
    setShiftTime(newTime);
    localStorage.setItem('shiftTime', newTime); 
  };

  const getAttendanceStatus = (timeString) => {
    if (!timeString) return { text: "Không rõ", color: "text-gray-500 bg-gray-500/10 border-gray-500/20" };
    try {
      const timePart = timeString.includes(' ') ? timeString.split(' ')[1] : timeString;
      const timeOnly = timePart.substring(0, 5); 
      
      if (timeOnly > shiftTime) {
        return { text: "Đi muộn", color: "text-[#f43f5e] bg-[#f43f5e]/10 border-[#f43f5e]/30" };
      }
      return { text: "Đúng giờ", color: "text-[#34d399] bg-[#34d399]/10 border-[#34d399]/30" };
    } catch {
      return { text: "Lỗi", color: "text-gray-500 bg-gray-500/10 border-gray-500/20" };
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/logs', {
        headers: { 'Authorization': `Bearer ${sessionStorage.getItem('token')}` }
      });
      if (res.status === 401) return window.location.href = '/admin/login'; 
      const data = await res.json();
      setLogs(data.data || []);
    } catch (error) { console.error("Lỗi lấy Logs:", error); }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users', {
        headers: { 'Authorization': `Bearer ${sessionStorage.getItem('token')}` }
      });
      if (res.status === 401) return window.location.href = '/admin/login'; 
      const data = await res.json();
      setUsers(data.data || []);
    } catch (error) { console.error("Lỗi lấy Nhân sự:", error); }
  };

  useEffect(() => {
    if (activeTab === 'logs') fetchLogs();
    if (activeTab === 'users') fetchUsers();
  }, [activeTab]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!photo) return alert("Vui lòng chọn ảnh!");
    
    setAddingStatus("saving");
    const data = new FormData();
    data.append('name', formData.name);
    data.append('student_code', formData.student_code);
    data.append('file', photo);

    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${sessionStorage.getItem('token')}` },
        body: data 
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
          fetchLogs(); 
          fetchUsers();
        }, 2000);
      }
    } catch (error) {
      alert("Lỗi kết nối Server!");
      setAddingStatus("error");
    }
  };

  const handleDeleteUser = async (studentCode, name) => {
    if (!window.confirm(`NGUY HIỂM: Bạn có chắc chắn muốn xóa sinh viên [${name} - ${studentCode}] khỏi Database?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/users/${studentCode}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${sessionStorage.getItem('token')}` }
      });
      
      const result = await res.json();

      if (res.ok) {
        alert("Đã xóa sạch dữ liệu của nhân sự này!");
        fetchUsers(); 
      } else {
        alert(result.detail || result.error || "Lỗi không thể xóa!");
      }
    } catch (error) {
      alert("Lỗi kết nối Server!");
    }
  };

  // Logic gom nhóm log theo ngày
  const groupedLogs = logs.reduce((acc, log) => {
    const date = log.time.includes(' ') ? log.time.split(' ')[0] : 'Không rõ ngày';
    if (!acc[date]) {
      acc[date] = []; 
    }
    acc[date].push(log); 
    return acc;
  }, {});

const lateStatsByPerson = logs.reduce((acc, log) => {
    const status = getAttendanceStatus(log.time).text;
    if (status === "Đi muộn") {
       const datePart = log.time.split(' ')[0];
       const parts = datePart.split('/');
       if(parts.length === 3) {
           const monthYear = `${parts[1]}/${parts[2]}`;
           
           // Nếu tháng này chưa có trong danh sách thì tạo mới
           if (!acc[monthYear]) acc[monthYear] = {};
           
           // Nếu nhân sự này chưa bị ghi sổ trong tháng thì tạo mới
           const id = log.student_code;
           if (!acc[monthYear][id]) {
               acc[monthYear][id] = { name: log.name, count: 0 };
           }
           
           // Tăng số lần đi muộn lên 1
           acc[monthYear][id].count += 1;
       }
    }
    return acc;
  }, {});

  return (
    <div className="flex-1 bg-[#0a0b0d] text-slate-300 overflow-y-auto font-sans p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8 border-b border-[#2d2d2d] pb-6">
          <div>
            <h1 className="text-sm font-mono tracking-[2px] font-bold text-[#f8fafc] uppercase">Quản trị Hệ thống FaceID</h1>
            <p className="text-[#64748b] font-mono text-[10px] uppercase tracking-wider mt-2">Danh sách điểm danh & Quản lý Database.</p>
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

        {/* THIẾT KẾ TAB NAVIGATION */}
        <div className="flex gap-4 mb-6 border-b border-[#2d2d2d]">
          <button 
            onClick={() => setActiveTab('logs')}
            className={`flex items-center gap-2 px-4 py-3 font-mono text-[11px] uppercase tracking-wider font-bold transition-colors ${activeTab === 'logs' ? 'text-[#34d399] border-b-2 border-[#34d399]' : 'text-[#64748b] hover:text-white'}`}
          >
            <List className="w-4 h-4" /> Lịch sử Điểm danh
          </button>
          <button 
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-2 px-4 py-3 font-mono text-[11px] uppercase tracking-wider font-bold transition-colors ${activeTab === 'users' ? 'text-[#34d399] border-b-2 border-[#34d399]' : 'text-[#64748b] hover:text-white'}`}
          >
            <Database className="w-4 h-4" /> Dữ liệu Database
          </button>
        </div>

        {/* NỘI DUNG TAB 1: LOGS (Đã được chia nhóm theo ngày) */}
        {activeTab === 'logs' && (
          <>
            <div className="mb-4 flex items-center justify-between bg-[#15171c] p-4 border border-[#2d2d2d]">
              <div className="flex items-center gap-3">
                <Clock className="text-[#34d399] w-5 h-5" />
                <span className="text-[12px] font-mono font-bold text-gray-300 uppercase tracking-wider">Quy định giờ vào ca:</span>
              </div>
              <div className="flex items-center gap-3">
                <input type="time" value={shiftTime} onChange={handleShiftTimeChange} className="bg-[#0a0b0d] border border-[#333] text-[#34d399] font-mono px-3 py-1 outline-none focus:border-[#34d399] transition-colors text-sm" />
              </div>
            </div>

            {/* --- KHỐI HIỂN THỊ THỐNG KÊ ĐI MUỘN TỪNG NGƯỜI --- */}
            <div className="mb-6 space-y-4">
              {Object.keys(lateStatsByPerson).length === 0 ? (
                 <div className="bg-[#15171c] border border-[#2d2d2d] p-4 rounded-md text-center text-[#64748b] font-mono text-[10px] uppercase">
                    Không có nhân sự nào đi muộn.
                 </div>
              ) : (
                Object.entries(lateStatsByPerson).map(([month, persons]) => (
                  <div key={month} className="bg-[#15171c] border border-[#f43f5e]/30 rounded-md shadow-lg overflow-hidden">
                    <div className="bg-[#f43f5e]/10 px-4 py-3 border-b border-[#f43f5e]/20 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-[#f43f5e]" />
                      <span className="text-[#f43f5e] font-mono font-bold text-xs uppercase tracking-wider">
                        Thống kê đi muộn - Tháng {month}
                      </span>
                    </div>
                    {/* Danh sách người đi muộn */}
                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {Object.entries(persons)
                        .sort((a, b) => b[1].count - a[1].count) // Sắp xếp ai đi muộn nhiều lên đầu
                        .map(([code, info]) => (
                        <div key={code} className="bg-[#0a0b0d] border border-[#2d2d2d] p-3 rounded flex items-center justify-between hover:border-[#f43f5e]/50 transition-colors">
                          <div>
                            <p className="text-[#f8fafc] text-xs font-bold mb-1">{info.name}</p>
                            <p className="text-[#34d399] font-mono text-[10px]">{code}</p>
                          </div>
                          <div className="flex flex-col items-end">
                             <span className="bg-[#f43f5e]/10 px-3 py-1 rounded text-[#f43f5e] font-bold font-mono text-[11px] uppercase tracking-wider">
                               {info.count} Lần
                             </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="space-y-6"> 
              {Object.keys(groupedLogs).length === 0 ? (
                 <div className="bg-[#15171c] border border-[#2d2d2d] p-8 text-center text-[#64748b] font-mono text-[10px] uppercase rounded-md">
                    Chưa có dữ liệu điểm danh.
                 </div>
              ) : (
                Object.keys(groupedLogs).map((date) => (
                  <div key={date} className="bg-[#15171c] border border-[#2d2d2d] overflow-hidden rounded-md shadow-lg">
                    
                    {/* Header Tiêu đề của từng ngày */}
                    <div className="bg-[#1c1f26] border-b border-[#333] px-6 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Calendar className="w-4 h-4 text-[#34d399]" />
                        <span className="font-mono text-sm font-bold text-[#f8fafc] tracking-wider">
                          Ngày {date}
                        </span>
                      </div>
                      <span className="bg-[#0a0b0d] border border-[#333] text-[#34d399] font-mono text-[10px] font-bold px-3 py-1 rounded-full uppercase">
                        {groupedLogs[date].length} Lượt quét
                      </span>
                    </div>

                    {/* Bảng dữ liệu của riêng ngày đó */}
                    <table className="w-full text-left text-sm">
                      <thead className="bg-[#0a0b0d] text-[#64748b] border-b border-[#333] font-mono text-[10px] uppercase tracking-wider">
                        <tr>
                          <th className="px-6 py-3 font-normal">Họ và Tên</th>
                          <th className="px-6 py-3 font-normal">Mã Sinh Viên</th>
                          <th className="px-6 py-3 font-normal">Giờ điểm danh</th>
                          <th className="px-6 py-3 font-normal">Trạng thái</th>
                        </tr>
                      </thead>
                      <tbody className="font-sans text-xs">
                        {groupedLogs[date].map((log, i) => (
                          <tr key={i} className="border-b border-[#2d2d2d] hover:bg-[#1c1f26] transition-colors">
                            <td className="px-6 py-4 text-[#f8fafc] font-medium">{log.name}</td>
                            <td className="px-6 py-4 text-[#34d399] font-mono font-bold tracking-wider">{log.student_code}</td>
                            <td className="px-6 py-4 text-[#64748b] font-mono font-bold text-[11px]">
                               {log.time.includes(' ') ? log.time.split(' ')[1] : log.time}
                            </td>
                            <td className="px-6 py-4">
                              {(() => {
                                const status = getAttendanceStatus(log.time);
                                return (
                                  <span className={`px-3 py-1.5 text-[10px] font-bold border rounded-sm ${status.color} uppercase tracking-wider`}>
                                    {status.text}
                                  </span>
                                );
                              })()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {/* NỘI DUNG TAB 2: DATABASE */}
        {activeTab === 'users' && (
          <div className="bg-[#15171c] border border-[#2d2d2d] overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#0a0b0d] text-[#64748b] border-b border-[#333] font-mono text-[10px] uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3 font-normal">Ảnh gốc (MinIO)</th>
                  <th className="px-6 py-3 font-normal">Họ và Tên</th>
                  <th className="px-6 py-3 font-normal">Mã Sinh Viên</th>
                  <th className="px-6 py-3 font-normal text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="font-sans text-xs">
                {users.map((u, i) => (
                  <tr key={i} className="border-b border-[#2d2d2d] hover:bg-[#1c1f26] group">
                    <td className="px-6 py-3">
                      <div className="w-10 h-10 rounded-md overflow-hidden border border-[#333] bg-[#0a0b0d]">
                         <img src={u.image_url} alt={u.name} className="w-full h-full object-cover" />
                      </div>
                    </td>
                    <td className="px-6 py-4 text-[#f8fafc] font-bold">{u.name}</td>
                    <td className="px-6 py-4 text-[#34d399] font-mono font-bold tracking-wider">{u.student_code}</td>
                    
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => handleDeleteUser(u.student_code, u.name)}
                        className="text-[#64748b] hover:text-[#f43f5e] hover:bg-[#f43f5e]/10 p-2 rounded transition-colors"
                        title="Xóa nhân sự khỏi hệ thống"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                   <tr>
                      <td colSpan="4" className="text-center py-8 text-[#64748b] font-mono text-[10px] uppercase">
                        Chưa có dữ liệu sinh viên nào trong Database.
                      </td>
                   </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

      </div>
    </div>
  );
}