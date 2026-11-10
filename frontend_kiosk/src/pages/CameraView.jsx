import React, { useRef, useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck,
  ShieldAlert,
  ScanFace,
  Focus,
  Fingerprint,
  Users,
  Sparkles,
  EyeOff,
  Camera,
  Zap,
  Volume2,
  VolumeX,
  LogOut,
  LogIn,
  Video,
} from 'lucide-react';

export default function CameraView() {
  const videoRef = useRef(null);
  const overlayRef = useRef(null);
  const prevFrameDataRef = useRef(null);
  const stableCountRef = useRef(0);
  const cooldownUntilRef = useRef(0);
  const isProcessingRef = useRef(false);

  const [status, setStatus] = useState('idle');
  const [user, setUser] = useState(null);
  const [attendanceInfo, setAttendanceInfo] = useState(null);
  const [telemetry, setTelemetry] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [isAutoScan, setIsAutoScan] = useState(true);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(true);
  const [edgeHint, setEdgeHint] = useState('Đang giám sát vùng nhận diện...');
  const [videoSource, setVideoSource] = useState('webcam'); // 'webcam' | 'rtsp'
  const [detectedFacesList, setDetectedFacesList] = useState([]);

  // Tổng hợp hiệu ứng âm thanh điện tử (Web Audio API) không cần file MP3 ngoài
  const playChime = useCallback(
    (type) => {
      if (!isVoiceEnabled) return;
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        const now = ctx.currentTime;
        if (type === 'success') {
          osc.type = 'sine';
          osc.frequency.setValueAtTime(880, now);
          osc.frequency.setValueAtTime(1174.66, now + 0.1);
          gain.gain.setValueAtTime(0.18, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
          osc.start(now);
          osc.stop(now + 0.35);
        } else if (type === 'spoof' || type === 'unknown') {
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(240, now);
          osc.frequency.setValueAtTime(180, now + 0.15);
          gain.gain.setValueAtTime(0.2, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
          osc.start(now);
          osc.stop(now + 0.4);
        }
      } catch (e) {
        // Bỏ qua nếu trình duyệt chặn autoplay âm thanh
      }
    },
    [isVoiceEnabled]
  );

  // Trợ lý Giọng nói AI Tiếng Việt (Web Speech Synthesis API)
  const speakVietnamese = useCallback(
    (text) => {
      if (!isVoiceEnabled || !('speechSynthesis' in window)) return;
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'vi-VN';
        utterance.rate = 1.05;
        utterance.pitch = 1.0;
        window.speechSynthesis.speak(utterance);
      } catch (e) {
        // Bỏ qua nếu thiết bị không hỗ trợ TTS
      }
    },
    [isVoiceEnabled]
  );

  useEffect(() => {
    let currentStream = null;

    navigator.mediaDevices
      .getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
      })
      .then((stream) => {
        currentStream = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            if (overlayRef.current && videoRef.current) {
              overlayRef.current.width = videoRef.current.videoWidth;
              overlayRef.current.height = videoRef.current.videoHeight;
            }
          };
        }
      })
      .catch((err) => console.error('Lỗi Camera:', err));

    return () => {
      if (currentStream) currentStream.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const clearOverlay = useCallback(() => {
    const canvas = overlayRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  const drawMultiTrackingBoxes = useCallback((faces) => {
    const canvas = overlayRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!faces || faces.length === 0) return;

    faces.forEach((face) => {
      const box = face.box;
      if (!box || box.w <= 0) return;

      const isKnown = face.is_known;
      const isSpoof = face.liveness && !face.liveness.is_live;
      const maskInfo = face.mask || {};
      const isMasked = maskInfo.is_masked;
      const improperMask = maskInfo.mask_status === 'improper_mask';

      let color = '#f43f5e'; // unknown: đỏ
      let mainLabel = 'UNKNOWN PERSON';

      if (isSpoof) {
        color = '#f97316'; // spoof: cam
        mainLabel = 'SPOOF DETECTED';
      } else if (isKnown) {
        if (isMasked) {
          color = '#38bdf8'; // masked: xanh dương
        } else {
          color = '#34d399'; // standard known: xanh ngọc
        }
        const confText = face.confidence ? ` • ${face.confidence}%` : '';
        mainLabel = `${face.user?.name || 'VERIFIED'}${confText}`;
      }

      const mirroredX = canvas.width - box.x - box.w;
      const y = box.y;
      const w = box.w;
      const h = box.h;

      ctx.strokeStyle = `${color}44`;
      ctx.lineWidth = 2;
      ctx.strokeRect(mirroredX, y, w, h);

      // HUD 4 góc sắc nét
      const cornerLen = Math.min(26, w * 0.22, h * 0.22);
      ctx.strokeStyle = color;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(mirroredX, y + cornerLen);
      ctx.lineTo(mirroredX, y);
      ctx.lineTo(mirroredX + cornerLen, y);
      ctx.moveTo(mirroredX + w - cornerLen, y);
      ctx.lineTo(mirroredX + w, y);
      ctx.lineTo(mirroredX + w, y + cornerLen);
      ctx.moveTo(mirroredX, y + h - cornerLen);
      ctx.lineTo(mirroredX, y + h);
      ctx.lineTo(mirroredX + cornerLen, y + h);
      ctx.moveTo(mirroredX + w - cornerLen, y + h);
      ctx.lineTo(mirroredX + w, y + h);
      ctx.lineTo(mirroredX + w, y + h - cornerLen);
      ctx.stroke();

      // Nhãn tên chính phía trên
      ctx.font = 'bold 15px monospace';
      const textWidth = ctx.measureText(mainLabel).width;
      ctx.fillStyle = 'rgba(10, 11, 13, 0.88)';
      ctx.fillRect(mirroredX, Math.max(0, y - 32), textWidth + 18, 26);
      ctx.fillStyle = color;
      ctx.fillText(mainLabel, mirroredX + 8, Math.max(18, y - 14));

      // Nhãn khẩu trang & PPE phía dưới
      let subLabel = improperMask
        ? '⚠️ KHẨU TRANG TỤT MŨI'
        : isMasked
        ? '✓ ĐÃ ĐEO KHẨU TRANG'
        : '● CHƯA ĐEO KHẨU TRANG';
      if (isSpoof) subLabel = 'ANTI-SPOOF BLOCKED';

      ctx.font = '11px monospace';
      const subWidth = ctx.measureText(subLabel).width;
      ctx.fillStyle = 'rgba(10, 11, 13, 0.88)';
      ctx.fillRect(mirroredX, y + h + 6, subWidth + 14, 20);
      ctx.fillStyle = improperMask ? '#eab308' : isMasked ? '#38bdf8' : '#cbd5e1';
      ctx.fillText(subLabel, mirroredX + 6, y + h + 20);
    });
  }, []);

  const triggerScan = useCallback(
    async (isAutoTriggered = false) => {
      if (videoSource === 'rtsp') return; // Trong chế độ RTSP stream đã tự động xử lý trên backend
      if (!videoRef.current || isProcessingRef.current) return;
      const video = videoRef.current;
      if (video.videoWidth === 0) return;

      clearOverlay();
      setStatus('scanning');
      isProcessingRef.current = true;

      const captureCanvas = document.createElement('canvas');
      captureCanvas.width = video.videoWidth;
      captureCanvas.height = video.videoHeight;
      captureCanvas.getContext('2d').drawImage(video, 0, 0);

      captureCanvas.toBlob(
        async (blob) => {
          if (!blob) {
            setStatus('idle');
            isProcessingRef.current = false;
            return;
          }

          const formData = new FormData();
          formData.append('file', blob, 'frame.jpg');

          try {
            const res = await fetch('/api/recognize', { method: 'POST', body: formData });
            const data = await res.json();

            if (data.status === 'error' || data.error) {
              setStatus('idle');
              isProcessingRef.current = false;
              cooldownUntilRef.current = Date.now() + 1800;
              if (!isAutoTriggered) {
                setErrorMessage(
                  data.message ||
                    data.error ||
                    'Không tìm thấy khuôn mặt, vui lòng nhìn thẳng vào camera!'
                );
                setStatus('quality_error');
                setTimeout(() => {
                  setStatus('idle');
                  isProcessingRef.current = false;
                }, 2500);
              } else {
                setEdgeHint('Chưa phát hiện khuôn mặt rõ nét ở vùng trung tâm...');
              }
              return;
            }

            if (data.status === 'quality_error') {
              setErrorMessage(data.message || 'Ảnh bị mờ hoặc thiếu sáng!');
              setTelemetry({ quality: data.quality });
              setStatus('quality_error');
              cooldownUntilRef.current = Date.now() + 2800;
              setTimeout(() => {
                setStatus('idle');
                isProcessingRef.current = false;
              }, 2600);
              return;
            }

            // Xử lý danh sách khuôn mặt (Walk-Through Multi-Face)
            const allFaces = data.faces && data.faces.length > 0 ? data.faces : [];
            setDetectedFacesList(allFaces);
            drawMultiTrackingBoxes(allFaces);

            if (data.status === 'spoof') {
              playChime('spoof');
              speakVietnamese('Cảnh báo an ninh! Phát hiện dấu hiệu giả mạo khuôn mặt.');
              setErrorMessage(data.message || 'Phát hiện dấu hiệu giả mạo khuôn mặt!');
              setTelemetry({ liveness: data.liveness, quality: data.quality, mask: data.mask });
              setStatus('spoof');
              cooldownUntilRef.current = Date.now() + 4000;
              setTimeout(() => {
                setStatus('idle');
                isProcessingRef.current = false;
                clearOverlay();
                setDetectedFacesList([]);
              }, 3500);
              return;
            }

            const recognizedFaces = allFaces.filter((f) => f.is_known);
            const isKnown = recognizedFaces.length > 0;

            setTelemetry({
              confidence: data.confidence ? `${data.confidence}%` : '',
              liveness: data.liveness,
              quality: data.quality,
              mask: data.mask,
            });

            if (isKnown) {
              playChime('success');
              const primaryFace = recognizedFaces[0];
              const att = primaryFace.attendance || data.attendance || {};
              setAttendanceInfo(att);
              setUser(primaryFace.user || data.user);
              setStatus('success');

              const recognizedNames = recognizedFaces.map((f) => f.user?.name).filter(Boolean);
              if (recognizedNames.length > 1) {
                speakVietnamese(
                  `Xin chào ${recognizedNames.join(' và ')}. Chấm công hàng loạt thành công!`
                );
              } else if (att.check_type === 'Check-out') {
                speakVietnamese(
                  `Chào tạm biệt ${primaryFace.user?.name || data.user?.name}. Bạn đã chấm công tan ca, tổng số giờ làm là ${att.work_hours} giờ.`
                );
              } else {
                speakVietnamese(
                  `Xin chào ${primaryFace.user?.name || data.user?.name}. Chấm công vào ca ${att.status || 'thành công'}.`
                );
              }
            } else {
              playChime('unknown');
              speakVietnamese('Không nhận diện được danh tính. Vui lòng liên hệ quản trị viên.');
              setStatus('unknown');
            }

            cooldownUntilRef.current = Date.now() + 4200;
            setTimeout(() => {
              setStatus('idle');
              isProcessingRef.current = false;
              clearOverlay();
              setDetectedFacesList([]);
            }, 3600);
          } catch (error) {
            console.error('Lỗi API:', error);
            setStatus('idle');
            isProcessingRef.current = false;
            cooldownUntilRef.current = Date.now() + 2000;
          }
        },
        'image/jpeg',
        0.92
      );
    },
    [clearOverlay, drawMultiTrackingBoxes, playChime, speakVietnamese, videoSource]
  );

  useEffect(() => {
    if (!isAutoScan) {
      setEdgeHint('Chế độ thủ công: Bấm nút để chấm công');
      return;
    }

    const sampleCanvas = document.createElement('canvas');
    sampleCanvas.width = 64;
    sampleCanvas.height = 48;
    const sampleCtx = sampleCanvas.getContext('2d', { willReadFrequently: true });

    const interval = setInterval(() => {
      if (
        !videoRef.current ||
        videoRef.current.videoWidth === 0 ||
        isProcessingRef.current ||
        Date.now() < cooldownUntilRef.current
      ) {
        return;
      }

      const vw = videoRef.current.videoWidth;
      const vh = videoRef.current.videoHeight;
      sampleCtx.drawImage(
        videoRef.current,
        vw * 0.25,
        vh * 0.15,
        vw * 0.5,
        vh * 0.7,
        0,
        0,
        64,
        48
      );

      const frameData = sampleCtx.getImageData(0, 0, 64, 48).data;
      if (prevFrameDataRef.current) {
        let diffSum = 0;
        let luminanceSum = 0;
        const totalPixels = 64 * 48;
        for (let i = 0; i < frameData.length; i += 4) {
          const gray =
            0.299 * frameData[i] + 0.587 * frameData[i + 1] + 0.114 * frameData[i + 2];
          const prevGray =
            0.299 * prevFrameDataRef.current[i] +
            0.587 * prevFrameDataRef.current[i + 1] +
            0.114 * prevFrameDataRef.current[i + 2];
          diffSum += Math.abs(gray - prevGray);
          luminanceSum += gray;
        }

        const avgMotion = diffSum / totalPixels;
        const avgBrightness = luminanceSum / totalPixels;

        if (avgBrightness > 28 && avgMotion >= 0.8 && avgMotion <= 8.5) {
          stableCountRef.current += 1;
          setEdgeHint(
            `Đang khóa mục tiêu ổn định (${Math.min(100, stableCountRef.current * 35)}%)...`
          );
          if (stableCountRef.current >= 3) {
            stableCountRef.current = 0;
            triggerScan(true);
          }
        } else if (avgMotion > 8.5) {
          stableCountRef.current = 0;
          setEdgeHint('Phát hiện chuyển động — vui lòng giữ yên khuôn mặt...');
        } else {
          stableCountRef.current = Math.max(0, stableCountRef.current - 1);
          setEdgeHint('Auto-Scan sẵn sàng • Bước vào vùng khung ngắm');
        }
      }
      prevFrameDataRef.current = new Uint8ClampedArray(frameData);
    }, 350);

    return () => clearInterval(interval);
  }, [isAutoScan, triggerScan]);

  return (
    <div className="flex-1 bg-black relative flex items-center justify-center overflow-hidden">
      {videoSource === 'webcam' ? (
        <>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="absolute w-full h-full object-cover transform -scale-x-100 opacity-85"
          />
          <canvas
            ref={overlayRef}
            className="absolute w-full h-full object-cover pointer-events-none z-10"
          />

          <div className="absolute w-72 h-80 border border-[#34d399]/20 rounded-3xl pointer-events-none z-10 flex items-center justify-center">
            <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-[#34d399]/25 to-transparent" />
          </div>
        </>
      ) : (
        <div className="absolute inset-0 w-full h-full flex flex-col items-center justify-center bg-[#0a0b0d]">
          <img
            src="/api/rtsp/stream"
            alt="Live RTSP AI Feed"
            className="w-full h-full object-contain"
          />
          <div className="absolute top-20 left-8 bg-[#15171c]/90 border border-[#eab308]/50 px-4 py-2 rounded font-mono text-xs text-[#eab308] z-20">
            ● LUỒNG CAMERA AN NINH RTSP • ĐA DIỆN WALK-THROUGH AI
          </div>
        </div>
      )}

      {/* Header & Trạng thái AI Pipeline */}
      <div className="absolute top-8 left-8 z-20 pointer-events-none space-y-2">
        <h2 className="text-xl font-mono tracking-[4px] font-bold text-white uppercase flex items-center gap-2">
          <Focus className="w-6 h-6 text-[#34d399]" /> Terminal Chấm Công AI v3.0
        </h2>
        <div className="flex items-center gap-3">
          <p className="text-[#34d399] font-mono text-xs tracking-widest uppercase animate-pulse">
            ● {videoSource === 'rtsp' ? 'Đang stream luồng camera an ninh RTSP...' : edgeHint}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          <span className="bg-[#15171c]/80 border border-[#2d2d2d] text-[#94a3b8] font-mono text-[10px] px-2.5 py-1 rounded uppercase">
            Multi-Face Walk-Through
          </span>
          <span className="bg-[#15171c]/80 border border-[#2d2d2d] text-[#34d399] font-mono text-[10px] px-2.5 py-1 rounded uppercase flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> CLAHE Auto-HDR
          </span>
          <span className="bg-[#15171c]/80 border border-[#2d2d2d] text-[#38bdf8] font-mono text-[10px] px-2.5 py-1 rounded uppercase">
            Khẩu trang PPE &amp; RTSP Stream
          </span>
        </div>
      </div>

      {/* Cụm nút điều khiển Auto-Scan & Trợ lý Giọng nói AI & Nguồn Camera */}
      <div className="absolute top-8 right-8 z-30 flex items-center gap-2.5">
        <button
          onClick={() => setVideoSource(videoSource === 'webcam' ? 'rtsp' : 'webcam')}
          className={`px-3.5 py-2 rounded-full font-mono text-xs uppercase font-bold tracking-wider border transition-all flex items-center gap-1.5 cursor-pointer ${
            videoSource === 'rtsp'
              ? 'bg-[#eab308]/15 border-[#eab308] text-[#eab308] shadow-[0_0_15px_rgba(234,179,8,0.2)]'
              : 'bg-[#15171c]/90 border-[#333] text-[#94a3b8] hover:text-white'
          }`}
          title="Chuyển đổi nguồn giữa Webcam máy tính và Camera IP RTSP"
        >
          <Video className="w-4 h-4" />
          {videoSource === 'rtsp' ? 'Nguồn: RTSP CCTV' : 'Nguồn: Webcam Kiosk'}
        </button>

        <button
          onClick={() => setIsVoiceEnabled(!isVoiceEnabled)}
          className={`px-3.5 py-2 rounded-full font-mono text-xs uppercase font-bold tracking-wider border transition-all flex items-center gap-2 cursor-pointer ${
            isVoiceEnabled
              ? 'bg-[#38bdf8]/15 border-[#38bdf8] text-[#38bdf8]'
              : 'bg-[#15171c]/90 border-[#333] text-[#64748b] hover:text-white'
          }`}
          title="Bật/Tắt giọng nói AI chào nhân viên"
        >
          {isVoiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          {isVoiceEnabled ? 'Giọng nói AI' : 'Tắt tiếng'}
        </button>

        {videoSource === 'webcam' && (
          <button
            onClick={() => setIsAutoScan(!isAutoScan)}
            className={`px-4 py-2 rounded-full font-mono text-xs uppercase font-bold tracking-wider border transition-all flex items-center gap-2 cursor-pointer ${
              isAutoScan
                ? 'bg-[#34d399]/15 border-[#34d399] text-[#34d399] shadow-[0_0_20px_rgba(52,211,153,0.25)]'
                : 'bg-[#15171c]/90 border-[#333] text-[#94a3b8] hover:text-white'
            }`}
          >
            <Zap className="w-4 h-4" />
            {isAutoScan ? 'Auto-Scan: BẬT' : 'Auto-Scan: TẮT'}
          </button>
        )}
      </div>

      {/* Nút bấm chấm công thủ công */}
      {videoSource === 'webcam' && (
        <button
          onClick={() => triggerScan(false)}
          disabled={status !== 'idle'}
          className="absolute bottom-24 z-40 bg-[#34d399] text-black px-10 py-4 rounded-full font-bold font-mono tracking-[2px] uppercase shadow-[0_0_30px_rgba(52,211,153,0.3)] hover:bg-[#2dbb86] hover:scale-105 hover:shadow-[0_0_40px_rgba(52,211,153,0.5)] active:scale-95 transition-all disabled:opacity-0 disabled:scale-90 flex items-center gap-3 cursor-pointer"
        >
          <Fingerprint className="w-6 h-6" />
          Xác nhận Chấm công
        </button>
      )}

      <AnimatePresence>
        {status === 'success' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            className="absolute z-30 flex justify-center"
          >
            <div className="bg-[#15171c]/95 backdrop-blur-md text-white px-12 py-8 flex flex-col items-center gap-4 border-2 border-[#34d399] rounded-2xl shadow-[0_20px_60px_rgba(52,211,153,0.3)]">
              <ShieldCheck className="w-16 h-16 text-[#34d399]" />
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 mb-2 flex-wrap">
                  {attendanceInfo?.check_type === 'Check-out' ? (
                    <span className="bg-[#38bdf8]/20 text-[#38bdf8] border border-[#38bdf8]/40 px-3 py-0.5 rounded-full font-mono text-xs font-bold uppercase inline-flex items-center gap-1.5">
                      <LogOut className="w-3.5 h-3.5" /> Check-out Tan Ca ({attendanceInfo.work_hours}h)
                    </span>
                  ) : (
                    <span className="bg-[#34d399]/20 text-[#34d399] border border-[#34d399]/40 px-3 py-0.5 rounded-full font-mono text-xs font-bold uppercase inline-flex items-center gap-1.5">
                      <LogIn className="w-3.5 h-3.5" /> Check-in Vào Ca • {attendanceInfo?.status || 'Đúng giờ'}
                    </span>
                  )}
                  {telemetry?.mask && (
                    <span
                      className={`px-3 py-0.5 rounded-full font-mono text-xs font-bold uppercase border ${
                        telemetry.mask.is_masked
                          ? 'bg-[#38bdf8]/20 text-[#38bdf8] border-[#38bdf8]/40'
                          : 'bg-[#64748b]/20 text-[#94a3b8] border-[#64748b]/40'
                      }`}
                    >
                      {telemetry.mask.label}
                    </span>
                  )}
                </div>
                <h3 className="font-mono font-bold text-xl uppercase text-[#34d399] mb-1">
                  {attendanceInfo?.is_duplicate ? 'Đã Ghi Nhận Trước Đó' : 'Chấm Công Thành Công'}
                </h3>
                <p className="text-white text-lg font-mono">
                  {user?.name}{' '}
                  <span className="text-[#64748b] ml-2">| {user?.student_code}</span>
                </p>
                {detectedFacesList.length > 1 && (
                  <p className="text-[#38bdf8] font-mono text-xs mt-1">
                    👥 Phát hiện đồng thời {detectedFacesList.length} người trong khung hình
                  </p>
                )}
                {telemetry && (
                  <div className="mt-3 flex items-center justify-center gap-3 text-[11px] font-mono text-[#94a3b8]">
                    <span className="bg-[#0a0b0d] px-2.5 py-1 rounded border border-[#2d2d2d] text-[#34d399]">
                      Độ khớp: {telemetry.confidence}
                    </span>
                    {telemetry.liveness && (
                      <span className="bg-[#0a0b0d] px-2.5 py-1 rounded border border-[#2d2d2d] text-[#38bdf8]">
                        Liveness: {Math.round(telemetry.liveness.liveness_score * 100)}%
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {status === 'spoof' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            className="absolute z-30 flex justify-center"
          >
            <div className="bg-[#15171c]/95 backdrop-blur-md text-white px-10 py-8 flex flex-col items-center gap-4 border-2 border-[#f97316] rounded-2xl shadow-[0_20px_60px_rgba(249,115,22,0.35)] max-w-md">
              <EyeOff className="w-16 h-16 text-[#f97316]" />
              <div className="text-center">
                <h3 className="font-mono font-bold text-lg uppercase text-[#f97316] mb-2">
                  Cảnh báo Chống Giả Mạo (Anti-Spoofing)
                </h3>
                <p className="text-slate-300 font-mono text-xs leading-relaxed">
                  {errorMessage}
                </p>
                {telemetry?.liveness && (
                  <p className="text-[#64748b] font-mono text-[11px] mt-3 uppercase">
                    Liveness Score: {Math.round(telemetry.liveness.liveness_score * 100)}% (Yêu cầu &ge; 48%)
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {status === 'quality_error' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            className="absolute z-30 flex justify-center"
          >
            <div className="bg-[#15171c]/95 backdrop-blur-md text-white px-10 py-7 flex flex-col items-center gap-3 border-2 border-[#eab308] rounded-2xl shadow-[0_20px_60px_rgba(234,179,8,0.25)] max-w-md">
              <Camera className="w-14 h-14 text-[#eab308]" />
              <div className="text-center">
                <h3 className="font-mono font-bold text-base uppercase text-[#eab308] mb-1">
                  Chất lượng khung hình chưa đạt
                </h3>
                <p className="text-slate-300 font-mono text-xs">{errorMessage}</p>
              </div>
            </div>
          </motion.div>
        )}

        {status === 'warning' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            className="absolute z-30 flex justify-center"
          >
            <div className="bg-[#15171c]/95 backdrop-blur-md text-white px-12 py-8 flex flex-col items-center gap-4 border-2 border-[#eab308] rounded-2xl shadow-[0_20px_60px_rgba(234,179,8,0.3)]">
              <Users className="w-16 h-16 text-[#eab308]" />
              <div className="text-center">
                <h3 className="font-mono font-bold text-xl uppercase text-[#eab308] mb-2">
                  Quá nhiều khuôn mặt
                </h3>
                <p className="text-[#64748b] font-mono text-sm uppercase tracking-wider">
                  Vui lòng bước vào khung hình từng người một.
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {status === 'unknown' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            className="absolute z-30 flex justify-center"
          >
            <div className="bg-[#15171c]/95 backdrop-blur-md text-white px-12 py-8 flex flex-col items-center gap-4 border-2 border-[#f43f5e] rounded-2xl shadow-[0_20px_60px_rgba(244,63,94,0.3)]">
              <ShieldAlert className="w-16 h-16 text-[#f43f5e]" />
              <div className="text-center">
                <h3 className="font-mono font-bold text-xl uppercase text-[#f43f5e] mb-2">
                  Không nhận diện được
                </h3>
                <p className="text-[#64748b] font-mono text-sm uppercase tracking-wider">
                  Vui lòng liên hệ Admin để đăng ký.
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {status === 'scanning' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute z-30 flex flex-col items-center gap-4 bg-[#0a0b0d]/80 px-8 py-6 rounded-2xl border border-[#34d399]/40 backdrop-blur-sm"
          >
            <ScanFace className="w-16 h-16 text-[#34d399] animate-pulse" />
            <p className="font-mono text-[#34d399] tracking-[3px] text-xs uppercase font-bold animate-pulse">
              Đang xử lý CLAHE + Anti-Spoofing + ArcFace...
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
