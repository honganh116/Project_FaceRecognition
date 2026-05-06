import React, { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, ShieldAlert, ScanFace, Focus, AlertTriangle } from 'lucide-react';

export default function CameraView() {
  const videoRef = useRef(null);
  const overlayRef = useRef(null); // Tấm kính trong suốt để vẽ khung Tracking
  const [status, setStatus] = useState('scanning'); 
  const [user, setUser] = useState(null);

  const statusRef = useRef(status);
  const isProcessingRef = useRef(false);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    let currentStream = null;
    let intervalId = null;

    navigator.mediaDevices.getUserMedia({ video: true })
      .then(stream => {
        currentStream = stream;
        if (videoRef.current) {
            videoRef.current.srcObject = stream;
            // Đồng bộ kích thước thẻ canvas với video gốc
            videoRef.current.onloadedmetadata = () => {
                if(overlayRef.current) {
                    overlayRef.current.width = videoRef.current.videoWidth;
                    overlayRef.current.height = videoRef.current.videoHeight;
                }
            }
        }
        intervalId = setInterval(captureAndRecognize, 1000); // Quét nhanh hơn (1s) cho tracking mượt
      })
      .catch(err => console.error("Lỗi Camera:", err));

    return () => {
      if (intervalId) clearInterval(intervalId);
      if (currentStream) currentStream.getTracks().forEach(track => track.stop());
    };
  }, []);

  // Hàm vẽ Bounding Box (Đã sửa lỗi ngược chữ)
  const drawTrackingBox = (box, isKnown) => {
    const canvas = overlayRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // Xóa khung cũ
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (box && box.w > 0) {
        ctx.strokeStyle = isKnown ? '#34d399' : '#f43f5e'; 
        ctx.lineWidth = 6;
        
        // CÔNG THỨC LẬT TỌA ĐỘ: X_mới = Chiều rộng màn hình - X_cũ - Chiều rộng khuôn mặt
        const mirroredX = canvas.width - box.x - box.w;
        
        // Vẽ khung tại tọa độ đã lật
        ctx.strokeRect(mirroredX, box.y, box.w, box.h);

        // Vẽ chữ (Chữ giờ đây đã hiển thị bình thường)
        ctx.font = "bold 20px monospace";
        ctx.fillStyle = isKnown ? '#34d399' : '#f43f5e';
        ctx.fillText(isKnown ? "TARGET LOCKED" : "UNKNOWN", mirroredX, box.y - 10);
    }
  };

  const captureAndRecognize = async () => {
    if (!videoRef.current || statusRef.current !== 'scanning' || isProcessingRef.current) return;
    
    const video = videoRef.current;
    if (video.videoWidth === 0) return;

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

        // Xóa khung cũ nếu không thấy mặt
        if (data.error) {
            if(overlayRef.current) overlayRef.current.getContext('2d').clearRect(0, 0, overlayRef.current.width, overlayRef.current.height);
            isProcessingRef.current = false;
            return; 
        }
        if (data.status === 'warning') {
            if(overlayRef.current) overlayRef.current.getContext('2d').clearRect(0, 0, overlayRef.current.width, overlayRef.current.height);
            setStatus('warning');
            setTimeout(() => { 
                setStatus('scanning'); 
                isProcessingRef.current = false; 
            }, 3000);
            return; // Dừng lại, không vẽ khung hay xử lý tiếp
        }

        // Vẽ khung bám theo mặt
        const isKnown = !!data.user;
        drawTrackingBox(data.box, isKnown);

        if (isKnown) {
          setStatus('success');
          setUser(data.user);
          setTimeout(() => { 
              setStatus('scanning'); 
              isProcessingRef.current = false;
              if(overlayRef.current) overlayRef.current.getContext('2d').clearRect(0, 0, overlayRef.current.width, overlayRef.current.height);
          }, 3000); 
        } 
        else {
          setStatus('unknown');
          setTimeout(() => { 
              setStatus('scanning'); 
              isProcessingRef.current = false; 
              if(overlayRef.current) overlayRef.current.getContext('2d').clearRect(0, 0, overlayRef.current.width, overlayRef.current.height);
          }, 3000);
        }
      } catch (error) {
        console.error('Lỗi API:', error);
        isProcessingRef.current = false;
      }
    }, 'image/jpeg');
  };

  return (
    <div className="flex-1 bg-black relative flex items-center justify-center overflow-hidden">
      
      {/* 1. Lớp Video (Tràn viền hoàn toàn) */}
      <video 
        ref={videoRef} 
        autoPlay 
        playsInline 
        className="absolute w-full h-full object-cover transform -scale-x-100 opacity-90" 
      />

      {/* 2. Lớp Kính Vẽ Khung (Đã bỏ transform -scale-x-100) */}
      <canvas
        ref={overlayRef}
        className="absolute w-full h-full object-cover pointer-events-none z-10"
      />

      {/* Thông tin góc trái trên */}
      <div className="absolute top-8 left-8 z-20 pointer-events-none">
        <h2 className="text-xl font-mono tracking-[4px] font-bold text-white mb-2 uppercase flex items-center gap-2">
           <Focus className="w-6 h-6 text-[#34d399]" /> Security Cam 01
        </h2>
        <p className="text-[#34d399] font-mono text-xs tracking-widest uppercase animate-pulse">● Live Tracking</p>
      </div>

      {/* Popup Thông báo */}
      <AnimatePresence>
        {status !== 'scanning' && (
          <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }} className="absolute bottom-16 z-30 flex justify-center w-full pointer-events-none">
            
            {status === 'success' ? (
              <div className="bg-[#15171c]/95 backdrop-blur-md text-white px-10 py-5 flex items-center gap-5 border border-[#34d399] rounded-xl">
                <ShieldCheck className="w-10 h-10 text-[#34d399]" />
                <div>
                  <h3 className="font-mono font-bold text-sm uppercase text-[#34d399] mb-1">Xác thực thành công</h3>
                  <p className="text-white text-sm font-mono">{user?.name} | {user?.student_code}</p>
                </div>
              </div>
            ) : status === 'warning' ? (
              // 🌟 GIAO DIỆN MỚI: CẢNH BÁO NHIỀU NGƯỜI (MÀU VÀNG)
              <div className="bg-[#15171c]/95 backdrop-blur-md text-white px-10 py-5 flex items-center gap-5 border border-[#eab308] rounded-xl shadow-[0_0_20px_rgba(234,179,8,0.2)]">
                <AlertTriangle className="w-10 h-10 text-[#eab308] animate-pulse" />
                <div>
                  <h3 className="font-mono font-bold text-sm uppercase text-[#eab308] mb-1">Lỗi Kiểm soát</h3>
                  <p className="text-[#64748b] font-mono text-sm uppercase tracking-wider">Phát hiện nhiều người. Vui lòng quét từng người!</p>
                </div>
              </div>
            ) : (
              <div className="bg-[#15171c]/95 backdrop-blur-md text-white px-10 py-5 flex items-center gap-5 border border-[#f43f5e] rounded-xl">
                <ShieldAlert className="w-10 h-10 text-[#f43f5e]" />
                <div>
                  <h3 className="font-mono font-bold text-sm uppercase text-[#f43f5e] mb-1">Cảnh báo An ninh</h3>
                  <p className="text-[#64748b] font-mono text-sm uppercase tracking-wider">Phát hiện người lạ!</p>
                </div>
              </div>
            )}

          </motion.div>
        )}
      </AnimatePresence>
      
      <div className="absolute bottom-8 right-8 z-20 flex items-center gap-2 text-[#34d399] font-mono text-[10px] uppercase pointer-events-none">
         <ScanFace className="w-4 h-4 animate-pulse" /> OPENCV Tracking Active
      </div>
    </div>
  );
}