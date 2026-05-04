// src/pages/UserPage.jsx
import React, { useRef, useEffect, useState } from 'react';

const UserPage = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [result, setResult] = useState({ type: 'info', message: 'Đang khởi động Camera...' });

  useEffect(() => {
    // Mở luồng Camera
    navigator.mediaDevices.getUserMedia({ video: true })
      .then(stream => {
        if (videoRef.current) videoRef.current.srcObject = stream;
        setResult({ type: 'info', message: 'Camera đã sẵn sàng! Bắt đầu quét...' });
        
        // Vòng lặp gửi ảnh mỗi 1.5s
        const interval = setInterval(captureAndRecognize, 1500);
        return () => clearInterval(interval);
      })
      .catch(err => {
        setResult({ type: 'warning', message: 'Lỗi: Không thể mở Webcam!' });
      });
  }, []);

  const captureAndRecognize = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    
    // Chụp ảnh từ video
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    canvas.toBlob(async (blob) => {
      const formData = new FormData();
      formData.append('file', blob, 'frame.jpg');

      try {
        const response = await fetch('http://localhost:8000/api/recognize', {
          method: 'POST',
          body: formData
        });
        const data = await response.json();

        if (data.user) {
          setResult({ type: 'success', message: `✅ Xin chào: ${data.user.name} (MSV: ${data.user.student_code})` });
          // Logic vẽ Bounding Box sẽ đặt ở đây khi API trả về tọa độ (data.box)
          // drawBoundingBox(data.box); 
        } else if (data.message && data.message.includes("lạ")) {
          setResult({ type: 'warning', message: `🚨 Phát hiện người lạ!` });
        }
      } catch (error) {
        console.error('Lỗi API:', error);
      }
    }, 'image/jpeg');
  };

  const drawBoundingBox = (box) => {
    const ctx = canvasRef.current.getContext('2d');
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    if(box) {
        ctx.strokeStyle = '#00FF00';
        ctx.lineWidth = 3;
        ctx.strokeRect(box.x, box.y, box.w, box.h);
    }
  };

  return (
    <div style={{ textAlign: 'center', padding: '20px', fontFamily: 'sans-serif' }}>
      <h2>🔍 Hệ thống Nhận diện Trí tuệ Nhân tạo</h2>
      <div style={{ position: 'relative', width: '640px', height: '480px', margin: '0 auto' }}>
        <video ref={videoRef} autoPlay playsInline style={{ width: '100%', height: '100%', transform: 'scaleX(-1)' }} />
        {/* Lớp Canvas trong suốt đè lên Video để vẽ Bounding Box */}
        <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', transform: 'scaleX(-1)' }} />
      </div>
      <div style={{ 
        marginTop: '20px', padding: '15px', borderRadius: '8px', fontWeight: 'bold',
        backgroundColor: result.type === 'success' ? '#d1e7dd' : result.type === 'warning' ? '#f8d7da' : '#e2e3e5',
        color: result.type === 'success' ? '#0f5132' : result.type === 'warning' ? '#842029' : '#383d41'
      }}>
        {result.message}
      </div>
    </div>
  );
};

export default UserPage;