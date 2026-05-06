import React, { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, ShieldAlert, ScanFace, Focus, Fingerprint } from 'lucide-react';

export default function CameraView() {
  const videoRef = useRef(null);
  const overlayRef = useRef(null); 
  // Thêm trạng thái 'idle' (Đang chờ bấm nút)
  const [status, setStatus] = useState('idle'); // idle | scanning | success | unknown
  const [user, setUser] = useState(null);

  const isProcessingRef = useRef(false);

  useEffect(() => {
    let currentStream = null;

    navigator.mediaDevices.getUserMedia({ video: true })
      .then(stream => {
        currentStream = stream;
        if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.onloadedmetadata = () => {
                if(overlayRef.current) {
                    overlayRef.current.width = videoRef.current.videoWidth;
                    overlayRef.current.height = videoRef.current.videoHeight;
                }
            }
        }
        // ĐÃ XÓA: setInterval ở đây để camera không tự động quét nữa
      })
      .catch(err => console.error("Lỗi Camera:", err));

    return () => {
      if (currentStream) currentStream.getTracks().forEach(track => track.stop());
    };
  }, []);

  const drawTrackingBox = (box, isKnown) => {
    const canvas = overlayRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (box && box.w > 0) {
        ctx.strokeStyle = isKnown ? '#34d399' : '#f43f5e'; 
        ctx.lineWidth = 6;
        const mirroredX = canvas.width - box.x - box.w;
        ctx.strokeRect(mirroredX, box.y, box.w, box.h);
        ctx.font = "bold 20px monospace";
        ctx.fillStyle = isKnown ? '#34d399' : '#f43f5e';
        ctx.fillText(isKnown ? "VERIFIED" : "UNKNOWN", mirroredX, box.y - 10);
    }
  };

  // Hàm này giờ sẽ được gọi khi BẤM NÚT
  const handleManualScan = async () => {
    if (!videoRef.current || isProcessingRef.current) return;
    
    const video = videoRef.current;
    if (video.videoWidth === 0) return;

    // Xóa khung xanh cũ trên kính (nếu có)
    if(overlayRef.current) {
        overlayRef.current.getContext('2d').clearRect(0, 0, overlayRef.current.width, overlayRef.current.height);
    }

    // Chuyển trạng thái sang đang quét để hiện tia laser và khóa nút
    setStatus('scanning');
    isProcessingRef.current = true;

    const captureCanvas = document.createElement('canvas');
    captureCanvas.width = video.videoWidth;
    captureCanvas.height = video.videoHeight;
    captureCanvas.getContext('2d').drawImage(video, 0, 0);
    
    captureCanvas.toBlob(async (blob) => {
      const formData = new FormData();
      formData.append('file', blob, 'frame.jpg');

      try {
        const res = await fetch('http://localhost:8000/api/recognize', { method: 'POST', body: formData });
        const data = await res.json();

        if (data.error) {
            setStatus('idle'); // Quét lỗi thì quay về trạng thái chờ
            isProcessingRef.current = false;
            alert("Lỗi: Không tìm thấy khuôn mặt, vui lòng nhìn thẳng camera!");
            return; 
        }

        const isKnown = !!data.user;
        drawTrackingBox(data.box, isKnown);

        if (isKnown) {
          setStatus('success');
          setUser(data.user);
        } else {
          setStatus('unknown');
        }

        // Hiện kết quả 3 giây rồi tự động dọn dẹp, quay về trạng thái 'idle' (chờ người tiếp theo)
        setTimeout(() => { 
            setStatus('idle'); 
            isProcessingRef.current = false;
            if(overlayRef.current) overlayRef.current.getContext('2d').clearRect(0, 0, overlayRef.current.width, overlayRef.current.height);
        }, 3000);

      } catch (error) {
        console.error('Lỗi API:', error);
        setStatus('idle');
        isProcessingRef.current = false;
      }
    }, 'image/jpeg');
  };

  return (
    <div className="flex-1 bg-black relative flex items-center justify-center overflow-hidden">
      
      <video ref={videoRef} autoPlay playsInline className="absolute w-full h-full object-cover transform -scale-x-100 opacity-80" />
      <canvas ref={overlayRef} className="absolute w-full h-full object-cover pointer-events-none z-10" />

      {/* Tiêu đề góc trái (Đã sửa cho khớp Use Case Chấm công) */}
      <div className="absolute top-8 left-8 z-20 pointer-events-none">
        <h2 className="text-xl font-mono tracking-[4px] font-bold text-white mb-2 uppercase flex items-center gap-2">
           <Focus className="w-6 h-6 text-[#34d399]" /> Terminal Chấm Công
        </h2>
        <p className="text-[#34d399] font-mono text-xs tracking-widest uppercase animate-pulse">● Sẵn sàng</p>
      </div>

      {/* NÚT BẤM QUÉT KHUÔN MẶT (Manual Trigger) */}
      <button 
        onClick={handleManualScan}
        disabled={status !== 'idle'} // Chỉ cho bấm khi đang rảnh
        className="absolute bottom-32 z-40 bg-[#34d399] text-black px-10 py-4 rounded-full font-bold font-mono tracking-[2px] uppercase shadow-[0_0_30px_rgba(52,211,153,0.3)] hover:bg-[#2dbb86] hover:scale-105 hover:shadow-[0_0_40px_rgba(52,211,153,0.5)] active:scale-95 transition-all disabled:opacity-0 disabled:scale-90 flex items-center gap-3 cursor-pointer"
      >
        <Fingerprint className="w-6 h-6" />
        Xác nhận Chấm công
      </button>

      {/* Popup Thông báo */}
      <AnimatePresence>
        {status === 'success' && (
          <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} className="absolute z-30 flex justify-center">
            <div className="bg-[#15171c]/95 backdrop-blur-md text-white px-12 py-8 flex flex-col items-center gap-4 border-2 border-[#34d399] rounded-2xl shadow-[0_20px_60px_rgba(52,211,153,0.3)]">
              <ShieldCheck className="w-16 h-16 text-[#34d399]" />
              <div className="text-center">
                <h3 className="font-mono font-bold text-xl uppercase text-[#34d399] mb-2">Chấm công thành công</h3>
                <p className="text-white text-lg font-mono">{user?.name} <span className="text-[#64748b] ml-2">| {user?.student_code}</span></p>
              </div>
            </div>
          </motion.div>
        )}

        {status === 'unknown' && (
          <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} className="absolute z-30 flex justify-center">
             <div className="bg-[#15171c]/95 backdrop-blur-md text-white px-12 py-8 flex flex-col items-center gap-4 border-2 border-[#f43f5e] rounded-2xl shadow-[0_20px_60px_rgba(244,63,94,0.3)]">
              <ShieldAlert className="w-16 h-16 text-[#f43f5e]" />
              <div className="text-center">
                <h3 className="font-mono font-bold text-xl uppercase text-[#f43f5e] mb-2">Không nhận diện được</h3>
                <p className="text-[#64748b] font-mono text-sm uppercase tracking-wider">Vui lòng liên hệ Admin để đăng ký.</p>
              </div>
            </div>
          </motion.div>
        )}
        
        {/* Hiệu ứng tia quét chỉ hiện ra lúc đang chờ API (khoảng vài trăm mili-giây) */}
        {status === 'scanning' && (
           <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute z-30 flex flex-col items-center gap-4">
               <ScanFace className="w-20 h-20 text-[#34d399] animate-pulse" />
               <p className="font-mono text-[#34d399] tracking-[4px] uppercase font-bold animate-pulse">Đang phân tích AI...</p>
           </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}