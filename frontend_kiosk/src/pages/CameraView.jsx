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
  const [telemetry, setTelemetry] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [isAutoScan, setIsAutoScan] = useState(true);
  const [edgeHint, setEdgeHint] = useState('Đang giám sát vùng nhận diện...');

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

  const drawTrackingBox = useCallback((box, boxType, labelText, subLabelText = '') => {
    const canvas = overlayRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!box || box.w <= 0) return;

    const colorMap = {
      success: '#34d399',
      spoof: '#f97316',
      unknown: '#f43f5e',
    };
    const color = colorMap[boxType] || '#f43f5e';
    const mirroredX = canvas.width - box.x - box.w;
    const y = box.y;
    const w = box.w;
    const h = box.h;

    // Khung mờ bán trong suốt
    ctx.strokeStyle = `${color}55`;
    ctx.lineWidth = 2;
    ctx.strokeRect(mirroredX, y, w, h);

    // Vẽ 4 góc HUD sắc nét
    const cornerLen = Math.min(28, w * 0.22, h * 0.22);
    ctx.strokeStyle = color;
    ctx.lineWidth = 5;
    ctx.beginPath();
    // Góc trên trái
    ctx.moveTo(mirroredX, y + cornerLen);
    ctx.lineTo(mirroredX, y);
    ctx.lineTo(mirroredX + cornerLen, y);
    // Góc trên phải
    ctx.moveTo(mirroredX + w - cornerLen, y);
    ctx.lineTo(mirroredX + w, y);
    ctx.lineTo(mirroredX + w, y + cornerLen);
    // Góc dưới trái
    ctx.moveTo(mirroredX, y + h - cornerLen);
    ctx.lineTo(mirroredX, y + h);
    ctx.lineTo(mirroredX + cornerLen, y + h);
    // Góc dưới phải
    ctx.moveTo(mirroredX + w - cornerLen, y + h);
    ctx.lineTo(mirroredX + w, y + h);
    ctx.lineTo(mirroredX + w, y + h - cornerLen);
    ctx.stroke();

    // Nhãn chính phía trên khung
    ctx.font = 'bold 16px monospace';
    const textWidth = ctx.measureText(labelText).width;
    ctx.fillStyle = 'rgba(10, 11, 13, 0.85)';
    ctx.fillRect(mirroredX, Math.max(0, y - 34), textWidth + 20, 28);
    ctx.fillStyle = color;
    ctx.fillText(labelText, mirroredX + 10, Math.max(20, y - 14));

    // Nhãn phụ phía dưới khung (Liveness & CLAHE)
    if (subLabelText) {
      ctx.font = '12px monospace';
      const subWidth = ctx.measureText(subLabelText).width;
      ctx.fillStyle = 'rgba(10, 11, 13, 0.85)';
      ctx.fillRect(mirroredX, y + h + 6, subWidth + 16, 22);
      ctx.fillStyle = '#cbd5e1';
      ctx.fillText(subLabelText, mirroredX + 8, y + h + 21);
    }
  }, []);

  const triggerScan = useCallback(
    async (isAutoTriggered = false) => {
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
                  data.message || data.error || 'Không tìm thấy khuôn mặt, vui lòng nhìn thẳng vào camera!'
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

            if (data.status === 'warning') {
              setStatus('warning');
              cooldownUntilRef.current = Date.now() + 3200;
              setTimeout(() => {
                setStatus('idle');
                isProcessingRef.current = false;
                clearOverlay();
              }, 3000);
              return;
            }

            if (data.status === 'spoof') {
              const livePct = data.liveness
                ? `${Math.round(data.liveness.liveness_score * 100)}%`
                : 'LOW';
              drawTrackingBox(
                data.box,
                'spoof',
                'SPOOF DETECTED',
                `Liveness: ${livePct} | Anti-Spoofing Blocked`
              );
              setErrorMessage(data.message || 'Phát hiện dấu hiệu giả mạo khuôn mặt!');
              setTelemetry({ liveness: data.liveness, quality: data.quality });
              setStatus('spoof');
              cooldownUntilRef.current = Date.now() + 4000;
              setTimeout(() => {
                setStatus('idle');
                isProcessingRef.current = false;
                clearOverlay();
              }, 3500);
              return;
            }

            const isKnown = !!data.user;
            const simPct = data.distance ? `${Math.round(data.distance * 100)}%` : '';
            const livePct = data.liveness
              ? `Live: ${Math.round(data.liveness.liveness_score * 100)}%`
              : '';

            drawTrackingBox(
              data.box,
              isKnown ? 'success' : 'unknown',
              isKnown ? `VERIFIED • ${simPct}` : 'UNKNOWN PERSON',
              `${livePct} | CLAHE Enhanced | Blur: ${data.quality?.blur_score ?? '-'}`
            );

            setTelemetry({
              confidence: simPct,
              liveness: data.liveness,
              quality: data.quality,
            });

            if (isKnown) {
              setStatus('success');
              setUser(data.user);
            } else {
              setStatus('unknown');
            }

            cooldownUntilRef.current = Date.now() + 4200;
            setTimeout(() => {
              setStatus('idle');
              isProcessingRef.current = false;
              clearOverlay();
            }, 3200);
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
    [clearOverlay, drawTrackingBox]
  );

  // Edge Computing: Tự động phát hiện người đứng ổn định ở vùng trung tâm để quét không chạm
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
      // Chỉ lấy vùng trung tâm nơi khuôn mặt xuất hiện
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

        // Nếu ánh sáng đủ và có chuyển động nhỏ (người đang đứng yên trước ống kính, không phải ảnh tĩnh tuyệt đối = 0)
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

      {/* Khung định vị trung tâm trên Kiosk */}
      <div className="absolute w-72 h-80 border border-[#34d399]/20 rounded-3xl pointer-events-none z-10 flex items-center justify-center">
        <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-[#34d399]/25 to-transparent" />
      </div>

      {/* Header & Trạng thái AI Pipeline */}
      <div className="absolute top-8 left-8 z-20 pointer-events-none space-y-2">
        <h2 className="text-xl font-mono tracking-[4px] font-bold text-white uppercase flex items-center gap-2">
          <Focus className="w-6 h-6 text-[#34d399]" /> Terminal Chấm Công AI v2.0
        </h2>
        <div className="flex items-center gap-3">
          <p className="text-[#34d399] font-mono text-xs tracking-widest uppercase animate-pulse">
            ● {edgeHint}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          <span className="bg-[#15171c]/80 border border-[#2d2d2d] text-[#94a3b8] font-mono text-[10px] px-2.5 py-1 rounded uppercase">
            ArcFace 512D + L2 Norm
          </span>
          <span className="bg-[#15171c]/80 border border-[#2d2d2d] text-[#34d399] font-mono text-[10px] px-2.5 py-1 rounded uppercase flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> CLAHE Auto-HDR
          </span>
          <span className="bg-[#15171c]/80 border border-[#2d2d2d] text-[#38bdf8] font-mono text-[10px] px-2.5 py-1 rounded uppercase">
            Anti-Spoofing Liveness
          </span>
        </div>
      </div>

      {/* Nút chuyển đổi chế độ Auto-Scan (Edge) */}
      <div className="absolute top-8 right-8 z-30 flex items-center gap-3">
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
      </div>

      {/* Nút bấm chấm công thủ công */}
      <button
        onClick={() => triggerScan(false)}
        disabled={status !== 'idle'}
        className="absolute bottom-24 z-40 bg-[#34d399] text-black px-10 py-4 rounded-full font-bold font-mono tracking-[2px] uppercase shadow-[0_0_30px_rgba(52,211,153,0.3)] hover:bg-[#2dbb86] hover:scale-105 hover:shadow-[0_0_40px_rgba(52,211,153,0.5)] active:scale-95 transition-all disabled:opacity-0 disabled:scale-90 flex items-center gap-3 cursor-pointer"
      >
        <Fingerprint className="w-6 h-6" />
        Xác nhận Chấm công
      </button>

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
                <h3 className="font-mono font-bold text-xl uppercase text-[#34d399] mb-2">
                  Chấm công thành công
                </h3>
                <p className="text-white text-lg font-mono">
                  {user?.name}{' '}
                  <span className="text-[#64748b] ml-2">| {user?.student_code}</span>
                </p>
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
