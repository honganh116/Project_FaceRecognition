import React, { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, ShieldAlert, ScanFace } from 'lucide-react';

export default function CameraView() {
  const videoRef = useRef(null);
  const [status, setStatus] = useState('scanning'); // scanning | success | unknown
  const [user, setUser] = useState(null);

  // Dùng statusRef để vòng lặp đọc được trạng thái thực tế nhất
  const statusRef = useRef(status);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: true })
      .then(stream => {
        if (videoRef.current) videoRef.current.srcObject = stream;
        // Quét mỗi 1.5 giây
        const interval = setInterval(captureAndRecognize, 1500); 
        return () => clearInterval(interval);
      })
      .catch(err => console.error("Lỗi Camera:", err));
  }, []);

  const captureAndRecognize = async () => {
    // 1. Chặn nếu camera chưa bật hoặc đang hiện thông báo thì không quét đè
    if (!videoRef.current || statusRef.current !== 'scanning') return;
    
    const video = videoRef.current;
    if (video.videoWidth === 0) return;

    // 2. Tự tạo canvas ảo trong RAM để chụp ảnh (Không cần canvasRef nữa)
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    
    canvas.toBlob(async (blob) => {
      const formData = new FormData();
      formData.append('file', blob, 'frame.jpg');

      try {
        const res = await fetch('http://localhost:8000/api/recognize', { method: 'POST', body: formData });
        const data = await res.json();

        if (data.user) {
          setStatus('success');
          setUser(data.user);
          // Cho hiện popup 3 giây rồi mới quét tiếp
          setTimeout(() => setStatus('scanning'), 3000); 
        } 
        else if (data.message && data.message.includes("lạ")) {
          setStatus('unknown');
          setTimeout(() => setStatus('scanning'), 3000);
        }
        // Nếu không có ai trong khung hình, giữ nguyên 'scanning'
      } catch (error) {
        console.error('Lỗi API:', error);
      }
    }, 'image/jpeg');
  };

  return (
    <div className="flex-1 bg-[#0a0b0d] flex flex-col items-center justify-center p-8 relative overflow-hidden">
      <div className="text-center mb-8 z-10">
        <h2 className="text-sm font-mono tracking-[2px] font-bold text-white mb-2 uppercase">Cổng kiểm soát An ninh</h2>
        <p className="text-[#64748b] font-mono text-[10px] tracking-wider uppercase">Vui lòng nhìn thẳng vào camera để xác minh.</p>
      </div>

      <div className="relative w-full max-w-3xl aspect-video bg-[#111] border border-[#333] overflow-hidden">
        <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover transform -scale-x-100" />
        
        {/* Lớp khung quét (Scanning Overlay) */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center pb-12">
            <motion.div animate={{
                borderColor: status === 'success' ? '#34d399' : status === 'unknown' ? '#f43f5e' : '#34d399',
                boxShadow: status === 'success' ? '0 0 20px rgba(52,211,153,0.4)' : status === 'unknown' ? '0 0 20px rgba(244,63,94,0.4)' : '0 0 15px rgba(52,211,153,0.2)'
            }} 
            /* ĐÃ SỬA: Tăng chiều rộng lên 320px, chiều cao 400px và bo góc cho đẹp */
            className="w-[320px] h-[400px] rounded-2xl border-2 relative overflow-hidden bg-transparent">
                
                {status === 'scanning' && (
                    <motion.div 
                        /* ĐÃ SỬA: Tăng tọa độ top animate lên 500 để tia quét chạy hết chiều cao mới */
                        initial={{ top: -100 }} 
                        animate={{ top: 500 }} 
                        transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                        className="absolute w-full h-[2px] bg-[#34d399] shadow-[0_0_15px_#34d399]" 
                    />
                )}
            </motion.div>
        </div>

        {/* Popup Thông báo */}
        <AnimatePresence>
          {status !== 'scanning' && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="absolute bottom-8 left-0 right-0 flex justify-center">
              {status === 'success' ? (
                <div className="bg-[#15171c]/95 text-white px-8 py-4 flex items-center gap-4 border border-[#34d399]">
                  <ShieldCheck className="w-8 h-8 text-[#34d399]" />
                  <div>
                    <h3 className="font-mono font-bold text-xs uppercase text-[#34d399] mb-1">Xác thực thành công</h3>
                    <p className="text-[#f8fafc] text-xs font-mono">{user?.name} • <span className="text-[#64748b]">{user?.student_code}</span></p>
                  </div>
                </div>
              ) : (
                <div className="bg-[#15171c]/95 text-white px-8 py-4 flex items-center gap-4 border border-[#f43f5e]">
                  <ShieldAlert className="w-8 h-8 text-[#f43f5e]" />
                  <div>
                    <h3 className="font-mono font-bold text-xs uppercase text-[#f43f5e] mb-1">Cảnh báo An ninh</h3>
                    <p className="text-[#64748b] font-mono text-xs uppercase">Phát hiện người lạ!</p>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      <div className="mt-8 flex items-center gap-2 text-[#64748b] font-mono text-[10px] uppercase">
         <ScanFace className="w-4 h-4 animate-pulse text-[#34d399]" /> Đang chạy model: Facenet (MTCNN)...
      </div>
    </div>
  );
}