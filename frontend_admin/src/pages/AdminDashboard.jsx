import React, { useState, useEffect, useRef } from 'react';
import {
  UserPlus,
  Save,
  CheckCircle2,
  Clock,
  Trash2,
  List,
  Database,
  Calendar,
  AlertCircle,
  Sparkles,
  Cpu,
  Upload,
  FileSpreadsheet,
  Search,
  Camera,
  LogIn,
  LogOut,
  Video,
  ShieldCheck,
} from 'lucide-react';
import { motion } from 'framer-motion';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('logs');

  const [logs, setLogs] = useState([]);
  const [users, setUsers] = useState([]);

  // RTSP IP Camera Streaming State
  const [rtspUrl, setRtspUrl] = useState('');
  const [rtspInput, setRtspInput] = useState('');
  const [isSavingRtsp, setIsSavingRtsp] = useState(false);
  const [rtspSaveMsg, setRtspSaveMsg] = useState(null);

  // Bộ lọc & Tìm kiếm nhanh
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all' | 'Check-in' | 'Check-out' | 'late'

  const [isAdding, setIsAdding] = useState(false);
  const [addingStatus, setAddingStatus] = useState('idle');
  const [formData, setFormData] = useState({ name: '', student_code: '' });
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [registerFeedback, setRegisterFeedback] = useState(null);

  // Chế độ chụp ảnh trực tiếp bằng Webcam khi đăng ký nhân sự
  const [useWebcamRegister, setUseWebcamRegister] = useState(false);
  const registerVideoRef = useRef(null);
  const registerStreamRef = useRef(null);

  const [shiftTime, setShiftTime] = useState('08:00');

  // --- STATE CHO TAB KIỂM THỬ AI & ANTI-SPOOFING ---
  const [testFile, setTestFile] = useState(null);
  const [testPreview, setTestPreview] = useState(null);
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const stopRegisterWebcam = () => {
    if (registerStreamRef.current) {
      registerStreamRef.current.getTracks().forEach((t) => t.stop());
      registerStreamRef.current = null;
    }
    setUseWebcamRegister(false);
  };

  const startRegisterWebcam = async () => {
    setUseWebcamRegister(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
      });
      registerStreamRef.current = stream;
      if (registerVideoRef.current) {
        registerVideoRef.current.srcObject = stream;
      }
    } catch (err) {
      alert('Không thể truy cập Camera trên thiết bị này!');
      setUseWebcamRegister(false);
    }
  };

  const captureFromRegisterWebcam = () => {
    if (!registerVideoRef.current || registerVideoRef.current.videoWidth === 0) return;
    const canvas = document.createElement('canvas');
    canvas.width = registerVideoRef.current.videoWidth;
    canvas.height = registerVideoRef.current.videoHeight;
    canvas.getContext('2d').drawImage(registerVideoRef.current, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const capturedFile = new File([blob], `webcam_${Date.now()}.jpg`, {
          type: 'image/jpeg',
        });
        setPhoto(capturedFile);
        setPhotoPreview(URL.createObjectURL(capturedFile));
        stopRegisterWebcam();
      },
      'image/jpeg',
      0.95
    );
  };

  useEffect(() => {
    return () => stopRegisterWebcam();
  }, []);

  const fetchShiftTime = async () => {
    try {
      const res = await fetch('/api/settings/shift-time');
      const data = await res.json();
      if (data.shift_time) setShiftTime(data.shift_time);
    } catch (e) {
      console.error('Lỗi lấy giờ vào ca', e);
    }
  };

  const handleShiftTimeChange = async (e) => {
    const newTime = e.target.value;
    setShiftTime(newTime);
    try {
      await fetch('/api/settings/shift-time', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionStorage.getItem('token')}`,
        },
        body: JSON.stringify({ shift_time: newTime }),
      });
    } catch (err) {
      console.error('Lỗi đồng bộ giờ vào ca lên server', err);
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/logs', {
        headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` },
      });
      if (res.status === 401) return (window.location.href = '/admin/login');
      const data = await res.json();
      setLogs(data.data || []);
    } catch (error) {
      console.error('Lỗi lấy Logs:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users', {
        headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` },
      });
      if (res.status === 401) return (window.location.href = '/admin/login');
      const data = await res.json();
      setUsers(data.data || []);
    } catch (error) {
      console.error('Lỗi lấy Nhân sự:', error);
    }
  };

  const fetchRtspUrl = async () => {
    try {
      const res = await fetch('/api/settings/rtsp', {
        headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` },
      });
      const data = await res.json();
      if (data.rtsp_url !== undefined) {
        setRtspUrl(data.rtsp_url);
        setRtspInput(data.rtsp_url);
      }
    } catch (err) {
      console.error('Lỗi lấy cấu hình RTSP:', err);
    }
  };

  const handleSaveRtsp = async (e) => {
    e.preventDefault();
    setIsSavingRtsp(true);
    setRtspSaveMsg(null);
    try {
      const res = await fetch('/api/settings/rtsp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionStorage.getItem('token')}`,
        },
        body: JSON.stringify({ rtsp_url: rtspInput }),
      });
      const data = await res.json();
      if (res.ok) {
        setRtspUrl(data.rtsp_url);
        setRtspSaveMsg('Đã lưu cấu hình Camera RTSP thành công!');
      } else {
        setRtspSaveMsg('Lỗi: ' + (data.detail || data.error || 'Không thể lưu cấu hình'));
      }
    } catch (err) {
      setRtspSaveMsg('Lỗi kết nối Server!');
    } finally {
      setIsSavingRtsp(false);
      setTimeout(() => setRtspSaveMsg(null), 3500);
    }
  };

  useEffect(() => {
    fetchShiftTime();
    fetchLogs();
    fetchUsers();
    fetchRtspUrl();
  }, [activeTab]);

  const handleExportCsv = async () => {
    try {
      const res = await fetch('/api/logs/export', {
        headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` },
      });
      if (!res.ok) return alert('Không thể xuất báo cáo!');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Bang_Cham_Cong_FaceID_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Lỗi kết nối khi xuất file Excel/CSV!');
    }
  };

  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
    setRegisterFeedback(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!photo) return alert('Vui lòng chọn ảnh hoặc chụp từ Camera!');

    setAddingStatus('saving');
    setRegisterFeedback(null);
    const data = new FormData();
    data.append('name', formData.name);
    data.append('student_code', formData.student_code);
    data.append('file', photo);

    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` },
        body: data,
      });
      const result = await res.json();

      if (result.error) {
        alert(result.error);
        setAddingStatus('error');
        setTimeout(() => setAddingStatus('idle'), 1500);
      } else {
        setAddingStatus('done');
        setRegisterFeedback(result);
        fetchLogs();
        fetchUsers();
        setTimeout(() => {
          setIsAdding(false);
          setAddingStatus('idle');
          setFormData({ name: '', student_code: '' });
          setPhoto(null);
          setPhotoPreview(null);
          setRegisterFeedback(null);
        }, 2800);
      }
    } catch (error) {
      alert('Lỗi kết nối Server!');
      setAddingStatus('error');
      setTimeout(() => setAddingStatus('idle'), 1500);
    }
  };

  const handleDeleteUser = async (studentCode, name) => {
    if (
      !window.confirm(
        `NGUY HIỂM: Bạn có chắc chắn muốn xóa sinh viên [${name} - ${studentCode}] khỏi toàn bộ 3 tầng Database (Postgres, Qdrant, MinIO)?`
      )
    ) {
      return;
    }

    try {
      const res = await fetch(`/api/users/${studentCode}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` },
      });

      const result = await res.json();

      if (res.ok) {
        alert('Đã xóa sạch dữ liệu và toàn bộ Multi-Embedding của nhân sự này!');
        fetchUsers();
      } else {
        alert(result.detail || result.error || 'Lỗi không thể xóa!');
      }
    } catch (error) {
      alert('Lỗi kết nối Server!');
    }
  };

  const handleRunAiDiagnostic = async (e) => {
    e.preventDefault();
    if (!testFile) return;
    setTestLoading(true);
    setTestResult(null);

    const form = new FormData();
    form.append('file', testFile);

    try {
      const res = await fetch('/api/extract', { method: 'POST', body: form });
      const data = await res.json();
      setTestResult(data);
    } catch (err) {
      setTestResult({ error: 'Không thể kết nối tới AI Engine!' });
    } finally {
      setTestLoading(false);
    }
  };

  // Lọc log theo từ khóa & loại chấm công & khẩu trang
  const filteredLogs = logs.filter((log) => {
    const q = searchQuery.trim().toLowerCase();
    const matchText =
      !q ||
      log.name?.toLowerCase().includes(q) ||
      log.student_code?.toLowerCase().includes(q);
    if (!matchText) return false;
    if (filterType === 'Check-in') return (log.check_type || 'Check-in') === 'Check-in';
    if (filterType === 'Check-out') return log.check_type === 'Check-out';
    if (filterType === 'late') return log.status === 'Đi muộn';
    if (filterType === 'mask_on') return (log.mask_status || '').toLowerCase().includes('đã đeo');
    if (filterType === 'no_mask') return (log.mask_status || '').toLowerCase().includes('chưa') || (log.mask_status || '').toLowerCase().includes('sai');
    return true;
  });

  const filteredUsers = users.filter((u) => {
    const q = searchQuery.trim().toLowerCase();
    return (
      !q ||
      u.name?.toLowerCase().includes(q) ||
      u.student_code?.toLowerCase().includes(q)
    );
  });

  const groupedLogs = filteredLogs.reduce((acc, log) => {
    const date = log.time.includes(' ') ? log.time.split(' ')[0] : 'Không rõ ngày';
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(log);
    return acc;
  }, {});

  const lateStatsByPerson = logs.reduce((acc, log) => {
    if (log.status === 'Đi muộn') {
      const datePart = log.time.split(' ')[0];
      const parts = datePart.split('/');
      if (parts.length === 3) {
        const monthYear = `${parts[1]}/${parts[2]}`;
        if (!acc[monthYear]) acc[monthYear] = {};
        const id = log.student_code;
        if (!acc[monthYear][id]) {
          acc[monthYear][id] = { name: log.name, count: 0 };
        }
        acc[monthYear][id].count += 1;
      }
    }
    return acc;
  }, {});

  return (
    <div className="flex-1 bg-[#0a0b0d] text-slate-300 overflow-y-auto font-sans p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 border-b border-[#2d2d2d] pb-6 gap-4">
          <div>
            <h1 className="text-sm font-mono tracking-[2px] font-bold text-[#f8fafc] uppercase flex items-center gap-2">
              Ứng dụng Quản trị FaceID AI v3.1
              <span className="bg-[#34d399]/15 text-[#34d399] border border-[#34d399]/30 text-[10px] px-2 py-0.5 rounded">
                Mask / PPE + RTSP CCTV + Multi-Face
              </span>
            </h1>
            <p className="text-[#64748b] font-mono text-[10px] uppercase tracking-wider mt-2">
              Điểm danh luồng liên tục, Nhận diện khẩu trang &amp; Giám sát Camera IP RTSP an ninh.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleExportCsv}
              className="bg-[#15171c] border border-[#38bdf8]/40 text-[#38bdf8] px-4 py-2 flex items-center gap-2 rounded-sm font-mono text-xs font-bold uppercase hover:bg-[#38bdf8]/10 transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" /> Xuất Excel / CSV
            </button>
            <button
              onClick={() => {
                if (isAdding) stopRegisterWebcam();
                setIsAdding(!isAdding);
              }}
              className="bg-[#34d399] text-black px-4 py-2 flex items-center gap-2 rounded-sm font-mono text-xs font-bold uppercase hover:bg-[#2dbb86] cursor-pointer"
            >
              <UserPlus className="w-5 h-5" /> Thêm nhân sự
            </button>
          </div>
        </div>

        {isAdding && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="bg-[#15171c] border border-[#2d2d2d] p-6 mb-8 rounded-md"
          >
            <h2 className="text-[10px] text-[#34d399] font-mono uppercase mb-6 border-b border-[#333] pb-2 flex items-center justify-between">
              <span>Đăng ký khuôn mặt mới (Hỗ trợ chụp trực tiếp từ Camera hoặc Tải ảnh)</span>
              <span>ArcFace 512D + Multi-Embedding</span>
            </h2>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-[#64748b] mb-2">
                    Mã Sinh Viên / Nhân Sự
                  </label>
                  <input
                    required
                    value={formData.student_code}
                    onChange={(e) => setFormData({ ...formData, student_code: e.target.value })}
                    className="w-full border-[#333] border bg-[#000] text-white px-3 py-2 outline-none font-mono text-sm focus:border-[#34d399]"
                    placeholder="VD: 24022255"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-[#64748b] mb-2">
                    Họ và Tên
                  </label>
                  <input
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full border-[#333] border bg-[#000] text-white px-3 py-2 outline-none text-sm focus:border-[#34d399]"
                    placeholder="Nguyễn Văn A"
                  />
                </div>
                {registerFeedback?.quality && (
                  <div className="bg-[#0a0b0d] border border-[#34d399]/40 p-3 rounded text-xs font-mono space-y-1">
                    <p className="text-[#34d399] font-bold">
                      ✓ Đã trích xuất Vector gốc &amp; đẩy 4 biến thể vào RQ Worker!
                    </p>
                    <p className="text-[#94a3b8] text-[11px]">
                      Độ nét (Laplacian): {registerFeedback.quality.blur_score} | Độ sáng:{' '}
                      {registerFeedback.quality.brightness}
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="block text-[10px] font-mono uppercase text-[#64748b]">
                    Nguồn ảnh khuôn mặt
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      useWebcamRegister ? stopRegisterWebcam() : startRegisterWebcam()
                    }
                    className="text-[10px] font-mono uppercase text-[#38bdf8] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    {useWebcamRegister ? 'Chuyển sang Tải file ảnh' : 'Mở Camera chụp trực tiếp'}
                  </button>
                </div>

                {useWebcamRegister ? (
                  <div className="bg-[#0a0b0d] border border-[#38bdf8]/50 p-3 rounded text-center space-y-3">
                    <video
                      ref={registerVideoRef}
                      autoPlay
                      playsInline
                      className="w-full h-44 object-cover rounded transform -scale-x-100 bg-black"
                    />
                    <button
                      type="button"
                      onClick={captureFromRegisterWebcam}
                      className="bg-[#38bdf8] text-black px-4 py-2 rounded font-mono text-xs font-bold uppercase hover:bg-[#0284c7] cursor-pointer"
                    >
                      Chụp Khung Hình Này
                    </button>
                  </div>
                ) : (
                  <div className="border border-dashed border-[#333] p-4 text-center bg-[#0a0b0d] relative cursor-pointer hover:border-[#34d399] flex items-center justify-center min-h-[110px]">
                    <input
                      type="file"
                      required={!photo}
                      accept="image/*"
                      onChange={handlePhotoSelect}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    {photoPreview ? (
                      <div className="flex items-center gap-4">
                        <img
                          src={photoPreview}
                          alt="Preview"
                          className="w-16 h-16 object-cover rounded border border-[#34d399]"
                        />
                        <div className="text-left">
                          <div className="text-[#34d399] font-mono text-xs">{photo?.name}</div>
                          <div className="text-[#64748b] font-mono text-[10px] mt-1">
                            Sẵn sàng qua bộ lọc CLAHE &amp; ArcFace
                          </div>
                        </div>
                      </div>
                    ) : (
                      <span className="text-[#64748b] font-mono text-[10px]">
                        Click chọn ảnh hoặc bấm &ldquo;Mở Camera chụp trực tiếp&rdquo; ở góc trên
                      </span>
                    )}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={addingStatus !== 'idle'}
                  className="w-full bg-[#1c1f26] border border-[#333] text-white py-3 flex items-center justify-center gap-2 font-mono text-xs uppercase font-bold hover:bg-[#2d2f36] disabled:opacity-50 cursor-pointer"
                >
                  {addingStatus === 'idle' && (
                    <>
                      <Save className="w-4 h-4" /> Đăng ký khuôn mặt
                    </>
                  )}
                  {addingStatus === 'saving' && (
                    <>
                      <Clock className="w-4 h-4 animate-spin" /> Đang cân bằng sáng &amp; trích xuất AI...
                    </>
                  )}
                  {addingStatus === 'done' && (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-[#34d399]" /> Đăng ký thành công!
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        )}

        {/* Thanh Tabs + Bộ lọc tìm kiếm */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b border-[#2d2d2d]">
          <div className="flex gap-4 overflow-x-auto pb-1 md:pb-0">
            <button
              onClick={() => setActiveTab('logs')}
              className={`flex items-center gap-2 px-4 py-3 font-mono text-[11px] uppercase tracking-wider font-bold transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'logs'
                  ? 'text-[#34d399] border-b-2 border-[#34d399]'
                  : 'text-[#64748b] hover:text-white'
              }`}
            >
              <List className="w-4 h-4" /> Lịch sử Điểm danh ({logs.length})
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`flex items-center gap-2 px-4 py-3 font-mono text-[11px] uppercase tracking-wider font-bold transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'users'
                  ? 'text-[#34d399] border-b-2 border-[#34d399]'
                  : 'text-[#64748b] hover:text-white'
              }`}
            >
              <Database className="w-4 h-4" /> Hồ sơ Nhân sự ({users.length})
            </button>
            <button
              onClick={() => setActiveTab('rtsp_cctv')}
              className={`flex items-center gap-2 px-4 py-3 font-mono text-[11px] uppercase tracking-wider font-bold transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'rtsp_cctv'
                  ? 'text-[#34d399] border-b-2 border-[#34d399]'
                  : 'text-[#64748b] hover:text-white'
              }`}
            >
              <Video className="w-4 h-4" /> Camera RTSP CCTV
            </button>
            <button
              onClick={() => setActiveTab('ai_lab')}
              className={`flex items-center gap-2 px-4 py-3 font-mono text-[11px] uppercase tracking-wider font-bold transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'ai_lab'
                  ? 'text-[#34d399] border-b-2 border-[#34d399]'
                  : 'text-[#64748b] hover:text-white'
              }`}
            >
              <Cpu className="w-4 h-4" /> Phòng Lab AI
            </button>
          </div>

          {activeTab !== 'ai_lab' && activeTab !== 'rtsp_cctv' && (
            <div className="flex items-center gap-2 pb-2 md:pb-0">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#64748b] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm tên hoặc mã SV..."
                  className="bg-[#15171c] border border-[#2d2d2d] focus:border-[#34d399] text-white pl-8 pr-3 py-1.5 rounded text-xs font-mono outline-none w-48"
                />
              </div>

              {activeTab === 'logs' && (
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="bg-[#15171c] border border-[#2d2d2d] text-slate-300 px-3 py-1.5 rounded text-xs font-mono outline-none focus:border-[#34d399]"
                >
                  <option value="all">Tất cả lượt quét</option>
                  <option value="Check-in">Chỉ Check-in (Vào ca)</option>
                  <option value="Check-out">Chỉ Check-out (Tan ca)</option>
                  <option value="late">Chỉ Đi muộn</option>
                  <option value="mask_on">Chỉ Đã đeo khẩu trang</option>
                  <option value="no_mask">Chưa đeo / Đeo sai khẩu trang</option>
                </select>
              )}
            </div>
          )}
        </div>

        {activeTab === 'logs' && (
          <>
            <div className="mb-4 flex items-center justify-between bg-[#15171c] p-4 border border-[#2d2d2d]">
              <div className="flex items-center gap-3">
                <Clock className="text-[#34d399] w-5 h-5" />
                <span className="text-[12px] font-mono font-bold text-gray-300 uppercase tracking-wider">
                  Quy định giờ vào ca chuẩn:
                </span>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="time"
                  value={shiftTime}
                  onChange={handleShiftTimeChange}
                  className="bg-[#0a0b0d] border border-[#333] text-[#34d399] font-mono px-3 py-1 outline-none focus:border-[#34d399] transition-colors text-sm"
                />
              </div>
            </div>

            <div className="mb-6 space-y-4">
              {Object.keys(lateStatsByPerson).length === 0 ? (
                <div className="bg-[#15171c] border border-[#2d2d2d] p-4 rounded-md text-center text-[#64748b] font-mono text-[10px] uppercase">
                  Không có nhân sự nào đi muộn.
                </div>
              ) : (
                Object.entries(lateStatsByPerson).map(([month, persons]) => (
                  <div
                    key={month}
                    className="bg-[#15171c] border border-[#f43f5e]/30 rounded-md shadow-lg overflow-hidden"
                  >
                    <div className="bg-[#f43f5e]/10 px-4 py-3 border-b border-[#f43f5e]/20 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-[#f43f5e]" />
                      <span className="text-[#f43f5e] font-mono font-bold text-xs uppercase tracking-wider">
                        Thống kê đi muộn - Tháng {month}
                      </span>
                    </div>
                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {Object.entries(persons)
                        .sort((a, b) => b[1].count - a[1].count)
                        .map(([code, info]) => (
                          <div
                            key={code}
                            className="bg-[#0a0b0d] border border-[#2d2d2d] p-3 rounded flex items-center justify-between hover:border-[#f43f5e]/50 transition-colors"
                          >
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
                  Không có dữ liệu điểm danh khớp bộ lọc.
                </div>
              ) : (
                Object.keys(groupedLogs).map((date) => (
                  <div
                    key={date}
                    className="bg-[#15171c] border border-[#2d2d2d] overflow-hidden rounded-md shadow-lg"
                  >
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

                    <table className="w-full text-left text-sm">
                      <thead className="bg-[#0a0b0d] text-[#64748b] border-b border-[#333] font-mono text-[10px] uppercase tracking-wider">
                        <tr>
                          <th className="px-6 py-3 font-normal">Họ và Tên</th>
                          <th className="px-6 py-3 font-normal">Mã Sinh Viên</th>
                          <th className="px-6 py-3 font-normal">Giờ quét</th>
                          <th className="px-6 py-3 font-normal">Phân loại</th>
                          <th className="px-6 py-3 font-normal">Khẩu trang / PPE</th>
                          <th className="px-6 py-3 font-normal">Trạng thái</th>
                          <th className="px-6 py-3 font-normal text-right">Số giờ làm</th>
                        </tr>
                      </thead>
                      <tbody className="font-sans text-xs">
                        {groupedLogs[date].map((log, i) => (
                          <tr
                            key={i}
                            className="border-b border-[#2d2d2d] hover:bg-[#1c1f26] transition-colors"
                          >
                            <td className="px-6 py-4 text-[#f8fafc] font-medium">{log.name}</td>
                            <td className="px-6 py-4 text-[#34d399] font-mono font-bold tracking-wider">
                              {log.student_code}
                            </td>
                            <td className="px-6 py-4 text-[#64748b] font-mono font-bold text-[11px]">
                              {log.time.includes(' ') ? log.time.split(' ')[1] : log.time}
                            </td>
                            <td className="px-6 py-4 font-mono">
                              {log.check_type === 'Check-out' ? (
                                <span className="inline-flex items-center gap-1 text-[#38bdf8] bg-[#38bdf8]/10 border border-[#38bdf8]/30 px-2.5 py-1 rounded-sm text-[10px] font-bold uppercase">
                                  <LogOut className="w-3 h-3" /> Check-out
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[#34d399] bg-[#34d399]/10 border border-[#34d399]/30 px-2.5 py-1 rounded-sm text-[10px] font-bold uppercase">
                                  <LogIn className="w-3 h-3" /> Check-in
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold border rounded-sm uppercase tracking-wider ${
                                  (log.mask_status || '').toLowerCase().includes('đã đeo')
                                    ? 'text-[#38bdf8] bg-[#38bdf8]/10 border-[#38bdf8]/30'
                                    : (log.mask_status || '').toLowerCase().includes('sai')
                                    ? 'text-[#f59e0b] bg-[#f59e0b]/10 border-[#f59e0b]/30'
                                    : (log.mask_status || '').toLowerCase().includes('chưa')
                                    ? 'text-[#94a3b8] bg-[#94a3b8]/10 border-[#94a3b8]/30'
                                    : 'text-[#64748b] bg-[#64748b]/10 border-[#64748b]/30'
                                }`}
                              >
                                {(log.mask_status || '').toLowerCase().includes('đã đeo') && (
                                  <ShieldCheck className="w-3 h-3" />
                                )}
                                {log.mask_status || 'Không rõ'}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span
                                className={`px-3 py-1.5 text-[10px] font-bold border rounded-sm ${
                                  log.status === 'Đi muộn'
                                    ? 'text-[#f43f5e] bg-[#f43f5e]/10 border-[#f43f5e]/30'
                                    : log.status === 'Tan ca'
                                    ? 'text-[#38bdf8] bg-[#38bdf8]/10 border-[#38bdf8]/30'
                                    : 'text-[#34d399] bg-[#34d399]/10 border-[#34d399]/30'
                                } uppercase tracking-wider`}
                              >
                                {log.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right font-mono font-bold text-slate-300">
                              {log.work_hours > 0 ? `${log.work_hours}h` : '-'}
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

        {/* TAB 2: DATABASE */}
        {activeTab === 'users' && (
          <div className="bg-[#15171c] border border-[#2d2d2d] overflow-hidden rounded-md">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#0a0b0d] text-[#64748b] border-b border-[#333] font-mono text-[10px] uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3 font-normal">Ảnh chuẩn hóa (MinIO Proxy)</th>
                  <th className="px-6 py-3 font-normal">Họ và Tên</th>
                  <th className="px-6 py-3 font-normal">Mã Sinh Viên</th>
                  <th className="px-6 py-3 font-normal">Vector Indexing</th>
                  <th className="px-6 py-3 font-normal text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="font-sans text-xs">
                {filteredUsers.map((u, i) => (
                  <tr key={i} className="border-b border-[#2d2d2d] hover:bg-[#1c1f26] group">
                    <td className="px-6 py-3">
                      <div className="w-11 h-11 rounded-md overflow-hidden border border-[#333] bg-[#0a0b0d] flex items-center justify-center">
                        <img
                          src={u.image_url}
                          alt={u.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      </div>
                    </td>
                    <td className="px-6 py-4 text-[#f8fafc] font-bold">{u.name}</td>
                    <td className="px-6 py-4 text-[#34d399] font-mono font-bold tracking-wider">
                      {u.student_code}
                    </td>
                    <td className="px-6 py-4">
                      <span className="bg-[#34d399]/10 text-[#34d399] border border-[#34d399]/30 px-2.5 py-1 rounded font-mono text-[10px] uppercase">
                        512D L2 + Multi-Pose
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleDeleteUser(u.student_code, u.name)}
                        className="text-[#64748b] hover:text-[#f43f5e] hover:bg-[#f43f5e]/10 p-2 rounded transition-colors cursor-pointer"
                        title="Xóa nhân sự khỏi hệ thống"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredUsers.length === 0 && (
                  <tr>
                    <td
                      colSpan="5"
                      className="text-center py-8 text-[#64748b] font-mono text-[10px] uppercase"
                    >
                      Không tìm thấy hồ sơ sinh viên nào.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 3: PHÒNG LAB KIỂM THỬ AI & ANTI-SPOOFING */}
        {activeTab === 'ai_lab' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-[#15171c] border border-[#2d2d2d] p-6 rounded-md">
              <h3 className="font-mono text-xs font-bold uppercase text-[#34d399] mb-2 flex items-center gap-2">
                <Sparkles className="w-4 h-4" /> Kiểm thử Pipeline Thị Giác Máy Tính (/api/extract)
              </h3>
              <p className="text-[#64748b] font-mono text-[11px] mb-6">
                Tải lên 1 bức ảnh bất kỳ để kiểm tra các thông số Tiền xử lý CLAHE, đánh giá độ nét
                Laplacian và điểm Chống giả mạo (Hybrid Liveness Score).
              </p>

              <form onSubmit={handleRunAiDiagnostic} className="space-y-4">
                <div className="border border-dashed border-[#333] p-6 text-center bg-[#0a0b0d] relative cursor-pointer hover:border-[#34d399] rounded">
                  <input
                    type="file"
                    accept="image/*"
                    required
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        setTestFile(f);
                        setTestPreview(URL.createObjectURL(f));
                        setTestResult(null);
                      }
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  {testPreview ? (
                    <div className="flex flex-col items-center gap-3">
                      <img
                        src={testPreview}
                        alt="Test preview"
                        className="w-32 h-32 object-cover rounded border border-[#34d399]"
                      />
                      <span className="text-[#34d399] font-mono text-xs">{testFile?.name}</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2 py-4">
                      <Upload className="w-6 h-6 text-[#64748b]" />
                      <span className="text-[#64748b] font-mono text-xs">
                        Chọn ảnh khuôn mặt thật hoặc ảnh chụp màn hình để test Anti-Spoofing
                      </span>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={testLoading || !testFile}
                  className="w-full bg-[#34d399] text-black py-3 rounded font-mono text-xs font-bold uppercase hover:bg-[#2dbb86] disabled:opacity-50 cursor-pointer"
                >
                  {testLoading
                    ? 'Đang phân tích FFT + YCrCb + ArcFace...'
                    : 'Chạy Phân Tích Chuyên Sâu'}
                </button>
              </form>
            </div>

            <div className="bg-[#15171c] border border-[#2d2d2d] p-6 rounded-md font-mono">
              <h3 className="text-xs font-bold uppercase text-[#f8fafc] mb-4 border-b border-[#333] pb-2">
                Kết quả Chẩn đoán AI Engine
              </h3>

              {!testResult && (
                <div className="text-[#64748b] text-xs py-12 text-center uppercase">
                  Chưa có dữ liệu phân tích. Hãy tải ảnh lên ở khung bên trái.
                </div>
              )}

              {testResult?.error && (
                <div className="bg-[#f43f5e]/10 border border-[#f43f5e]/40 text-[#f43f5e] p-4 rounded text-xs">
                  {testResult.error}
                </div>
              )}

              {testResult && !testResult.error && (
                <div className="space-y-4 text-xs">
                  <div className="bg-[#0a0b0d] border border-[#2d2d2d] p-4 rounded space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[#64748b] uppercase">Trạng thái Liveness:</span>
                      <span
                        className={`font-bold px-2.5 py-0.5 rounded ${
                          testResult.liveness?.is_live
                            ? 'bg-[#34d399]/15 text-[#34d399]'
                            : 'bg-[#f97316]/15 text-[#f97316]'
                        }`}
                      >
                        {testResult.liveness?.is_live
                          ? 'REAL FACE (Hợp lệ)'
                          : 'SPOOF / WARNING'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[#64748b]">Điểm Liveness tổng hợp:</span>
                      <span className="text-[#38bdf8] font-bold">
                        {Math.round((testResult.liveness?.liveness_score || 0) * 100)}%
                      </span>
                    </div>
                    <p className="text-[11px] text-[#94a3b8] pt-1 border-t border-[#222]">
                      {testResult.liveness?.reason}
                    </p>
                  </div>

                  <div className="bg-[#0a0b0d] border border-[#2d2d2d] p-4 rounded space-y-2">
                    <p className="text-[#34d399] font-bold uppercase text-[11px]">
                      Tiền xử lý &amp; Chất lượng ảnh
                    </p>
                    <div className="grid grid-cols-3 gap-2 text-[11px]">
                      <div className="bg-[#15171c] p-2 rounded">
                        <span className="text-[#64748b] block">Độ nét (Blur)</span>
                        <span className="text-white font-bold">
                          {testResult.quality?.blur_score}
                        </span>
                      </div>
                      <div className="bg-[#15171c] p-2 rounded">
                        <span className="text-[#64748b] block">Độ sáng</span>
                        <span className="text-white font-bold">
                          {testResult.quality?.brightness}
                        </span>
                      </div>
                      <div className="bg-[#15171c] p-2 rounded">
                        <span className="text-[#64748b] block">Tương phản</span>
                        <span className="text-white font-bold">
                          {testResult.quality?.contrast}
                        </span>
                      </div>
                    </div>
                    <p className="text-[10px] text-[#94a3b8]">
                      Bộ lọc đã áp dụng:{' '}
                      {(testResult.quality?.enhancements_applied || []).join(' → ')}
                    </p>
                  </div>

                  {testResult.mask && (
                    <div className="bg-[#0a0b0d] border border-[#2d2d2d] p-4 rounded space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[#64748b] uppercase">Khẩu Trang / PPE:</span>
                        <span
                          className={`font-bold px-2.5 py-0.5 rounded text-[11px] ${
                            testResult.mask.ppe_compliant
                              ? 'bg-[#38bdf8]/15 text-[#38bdf8] border border-[#38bdf8]/30'
                              : 'bg-[#f59e0b]/15 text-[#f59e0b] border border-[#f59e0b]/30'
                          }`}
                        >
                          {testResult.mask.label}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-[#64748b]">Tỉ lệ che phủ / Độ tin cậy:</span>
                        <span className="text-white font-bold">
                          {Math.round((testResult.mask.confidence || 0) * 100)}%
                        </span>
                      </div>
                      <p className="text-[10px] text-[#94a3b8] pt-1 border-t border-[#222]">
                        {testResult.mask.details}
                      </p>
                    </div>
                  )}

                  <div className="bg-[#0a0b0d] border border-[#2d2d2d] p-4 rounded space-y-1">
                    <p className="text-[#34d399] font-bold uppercase text-[11px]">
                      Vector ArcFace ({testResult.vector_length} chiều - Chuẩn hóa L2)
                    </p>
                    <p className="text-[10px] text-[#64748b] break-all">
                      5 chiều đầu: [{(testResult.vector_sample || []).map((v) => v.toFixed(4)).join(', ')}
                      , ...]
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: GIÁM SÁT CAMERA RTSP CCTV & MULTI-FACE TRACKING */}
        {activeTab === 'rtsp_cctv' && (
          <div className="space-y-6">
            <div className="bg-[#15171c] border border-[#2d2d2d] p-6 rounded-md">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 pb-4 border-b border-[#2d2d2d]">
                <div>
                  <h3 className="font-mono text-xs font-bold uppercase text-[#34d399] flex items-center gap-2">
                    <Video className="w-4 h-4" /> Cấu hình Luồng RTSP IP Camera An Ninh
                  </h3>
                  <p className="text-[#64748b] font-mono text-[11px] mt-1">
                    Hỗ trợ Camera Dahua, Hikvision, Ezviz, Uniview hoặc camera chuẩn ONVIF/RTSP.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-[#34d399]/10 border border-[#34d399]/30 text-[#34d399] font-mono text-[11px]">
                    <span className="w-2 h-2 rounded-full bg-[#34d399] animate-pulse" />
                    LIVE HUD OVERLAY
                  </span>
                </div>
              </div>

              <form onSubmit={handleSaveRtsp} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-[#64748b] mb-2">
                    Đường dẫn RTSP Stream URL
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={rtspInput}
                      onChange={(e) => setRtspInput(e.target.value)}
                      placeholder="rtsp://admin:pass@192.168.1.100:554/live/ch0 (hoặc 0 để dùng Webcam máy trạm)"
                      className="flex-1 bg-[#0a0b0d] border border-[#333] focus:border-[#34d399] text-white px-3 py-2 font-mono text-xs outline-none rounded-sm"
                    />
                    <button
                      type="submit"
                      disabled={isSavingRtsp}
                      className="bg-[#34d399] text-black px-5 py-2 font-mono text-xs font-bold uppercase rounded-sm hover:bg-[#2dbb86] disabled:opacity-50 cursor-pointer flex items-center gap-2"
                    >
                      <Save className="w-3.5 h-3.5" />
                      {isSavingRtsp ? 'Đang lưu...' : 'Lưu RTSP'}
                    </button>
                  </div>
                  <p className="text-[10px] font-mono text-[#64748b] mt-2">
                    Gợi ý: Điền <span className="text-[#38bdf8]">0</span> để tự động trỏ về Webcam cục bộ, hoặc điền URL RTSP từ Camera IP. Nếu chưa có camera IP thật, hệ thống tự động sinh luồng CCTV giả lập thông minh.
                  </p>
                </div>

                {rtspSaveMsg && (
                  <div className="bg-[#34d399]/10 border border-[#34d399]/40 text-[#34d399] px-3 py-2 rounded text-xs font-mono">
                    {rtspSaveMsg}
                  </div>
                )}
              </form>
            </div>

            {/* Video Player Box */}
            <div className="bg-[#15171c] border border-[#2d2d2d] p-6 rounded-md">
              <div className="flex items-center justify-between mb-4">
                <span className="font-mono text-xs font-bold uppercase text-[#f8fafc] flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#f43f5e] animate-pulse" />
                  Luồng Giám Sát Trực Tiếp (/api/rtsp/stream)
                </span>
                <span className="text-[#64748b] font-mono text-[11px]">
                  SSD Multi-Face Tracker + Periocular CLAHE
                </span>
              </div>

              <div className="relative bg-black rounded overflow-hidden border border-[#2d2d2d] flex items-center justify-center min-h-[380px]">
                <img
                  src="/api/rtsp/stream"
                  alt="Live RTSP Multi-Face Feed"
                  className="w-full h-full object-contain max-h-[540px]"
                />
                <div className="absolute top-4 left-4 bg-[#0a0b0d]/80 backdrop-blur-sm border border-[#34d399]/40 text-[#34d399] px-3 py-1.5 rounded font-mono text-xs flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#34d399] animate-ping" />
                  AI MULTI-FACE WALK-THROUGH ACTIVE
                </div>
                <div className="absolute bottom-4 left-4 right-4 bg-[#0a0b0d]/80 backdrop-blur-sm border border-[#2d2d2d] px-4 py-2 rounded flex items-center justify-between font-mono text-[11px] text-[#94a3b8]">
                  <span>Trạng thái: Đang phân tích luồng thời gian thực</span>
                  <span>Nhận diện đồng thời nhiều người + Tự động bù sáng vùng mắt</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                <div className="bg-[#0a0b0d] border border-[#2d2d2d] p-4 rounded">
                  <p className="text-[#34d399] font-mono text-xs font-bold uppercase mb-1">
                    Multi-Face Walk-Through
                  </p>
                  <p className="text-[#94a3b8] text-[11px] font-mono">
                    Thuật toán SSD DeepFace trích xuất đồng thời toàn bộ khuôn mặt trong khung hình, hỗ trợ đi bộ theo nhóm qua cổng kiểm soát.
                  </p>
                </div>
                <div className="bg-[#0a0b0d] border border-[#2d2d2d] p-4 rounded">
                  <p className="text-[#38bdf8] font-mono text-xs font-bold uppercase mb-1">
                    Phát hiện Khẩu trang / PPE
                  </p>
                  <p className="text-[#94a3b8] text-[11px] font-mono">
                    Tự động nhận diện khẩu trang phẫu thuật, khẩu trang đen/trắng, phân loại tuân thủ an toàn &amp; kích hoạt Periocular ArcFace.
                  </p>
                </div>
                <div className="bg-[#0a0b0d] border border-[#2d2d2d] p-4 rounded">
                  <p className="text-[#f59e0b] font-mono text-xs font-bold uppercase mb-1">
                    Tương thích RTSP / ONVIF
                  </p>
                  <p className="text-[#94a3b8] text-[11px] font-mono">
                    Kết nối camera an ninh IP hiện hữu thông qua giao thức chuẩn RTSP H.264/MJPEG không cần thay đổi phần cứng.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
