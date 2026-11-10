import cv2
import numpy as np
from typing import Dict, Any, List, Tuple


def normalize_embedding(embedding: List[float]) -> List[float]:
    """
    Chuẩn hóa L2 (Unit Norm) cho vector đặc trưng 512 chiều của ArcFace,
    giúp tối ưu hóa độ chính xác khi tính khoảng cách Cosine trong Qdrant.
    """
    vec = np.asarray(embedding, dtype=np.float32)
    norm = np.linalg.norm(vec)
    if norm > 1e-8:
        vec = vec / norm
    return vec.tolist()


def assess_image_quality(img: np.ndarray) -> Dict[str, Any]:
    """
    Đánh giá chất lượng ảnh đầu vào:
    - Độ sắc nét / độ mờ (Variance of Laplacian)
    - Độ sáng trung bình (Mean Luminance)
    - Độ tương phản (RMS Contrast)
    """
    if img is None or img.size == 0:
        return {
            "is_valid": False,
            "reason": "Ảnh đầu vào rỗng hoặc bị lỗi giải mã.",
            "blur_score": 0.0,
            "brightness": 0.0,
            "contrast": 0.0,
        }

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    blur_score = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    brightness = float(np.mean(gray))
    contrast = float(np.std(gray))

    # Ngưỡng đánh giá thực tế cho webcam
    is_blurry = blur_score < 25.0
    is_too_dark = brightness < 30.0
    is_too_bright = brightness > 240.0

    lighting_status = "good"
    if brightness < 75.0:
        lighting_status = "low_light"
    elif brightness > 195.0:
        lighting_status = "overexposed"

    is_valid = not (is_blurry or is_too_dark or is_too_bright)
    reason = "Chất lượng ảnh đạt chuẩn"
    if is_blurry:
        reason = "Ảnh bị mờ hoặc rung (Motion Blur). Vui lòng giữ yên khuôn mặt trước camera!"
    elif is_too_dark:
        reason = "Môi trường quá tối. Vui lòng tăng ánh sáng!"
    elif is_too_bright:
        reason = "Ảnh bị lóa sáng quá mức. Vui lòng tránh ngược sáng mạnh!"

    return {
        "is_valid": is_valid,
        "reason": reason,
        "blur_score": round(blur_score, 2),
        "brightness": round(brightness, 2),
        "contrast": round(contrast, 2),
        "lighting_status": lighting_status,
    }


def apply_gamma_correction(img: np.ndarray, gamma: float) -> np.ndarray:
    """Hiệu chỉnh Gamma giúp cân bằng sáng tự nhiên."""
    inv_gamma = 1.0 / max(gamma, 0.1)
    table = np.array(
        [((i / 255.0) ** inv_gamma) * 255 for i in np.arange(0, 256)]
    ).astype("uint8")
    return cv2.LUT(img, table)


def enhance_face_image(img: np.ndarray) -> Tuple[np.ndarray, Dict[str, Any]]:
    """
    Pipeline tiền xử lý ảnh thông minh:
    1. Đánh giá độ sáng & tự động hiệu chỉnh Adaptive Gamma nếu thiếu sáng / dư sáng.
    2. Chuyển sang không gian màu LAB và áp dụng CLAHE trên kênh L (Luminance)
       để tăng cường chi tiết khuôn mặt trong điều kiện ngược sáng.
    3. Khử nhiễu nhẹ bảo toàn cạnh (Bilateral Filtering) nếu ảnh thiếu sáng.
    """
    quality = assess_image_quality(img)
    enhanced = img.copy()
    applied_steps = []

    brightness = quality["brightness"]
    if brightness < 80.0:
        # Làm sáng ảnh thiếu sáng bằng Gamma > 1.0
        gamma = np.clip(1.0 + (85.0 - brightness) / 100.0, 1.15, 1.8)
        enhanced = apply_gamma_correction(enhanced, float(gamma))
        applied_steps.append(f"gamma_boost({gamma:.2f})")
    elif brightness > 195.0:
        # Giảm chói bằng Gamma < 1.0
        gamma = np.clip(1.0 - (brightness - 190.0) / 150.0, 0.65, 0.9)
        enhanced = apply_gamma_correction(enhanced, float(gamma))
        applied_steps.append(f"gamma_reduce({gamma:.2f})")

    # Áp dụng CLAHE trên kênh L của hệ màu LAB
    lab = cv2.cvtColor(enhanced, cv2.COLOR_BGR2LAB)
    l_channel, a_channel, b_channel = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    l_enhanced = clahe.apply(l_channel)
    lab_enhanced = cv2.merge((l_enhanced, a_channel, b_channel))
    enhanced = cv2.cvtColor(lab_enhanced, cv2.COLOR_LAB2BGR)
    applied_steps.append("clahe_lab")

    # Khử nhiễu hạt nếu môi trường thiếu sáng nhưng vẫn giữ sắc nét đường nét khuôn mặt
    if brightness < 75.0:
        enhanced = cv2.bilateralFilter(enhanced, d=5, sigmaColor=35, sigmaSpace=35)
        applied_steps.append("bilateral_denoise")

    quality["enhancements_applied"] = applied_steps
    return enhanced, quality


def check_face_liveness(
    img: np.ndarray, facial_area: Dict[str, int]
) -> Dict[str, Any]:
    """
    Hệ thống phát hiện giả mạo khuôn mặt đa đặc trưng (Hybrid Face Anti-Spoofing):
    Phân tích vùng khuôn mặt để phát hiện tấn công bằng màn hình điện thoại (Replay Attack)
    hoặc ảnh in giấy (Print Attack) dựa trên:
    1. Phổ tần số cao 2D FFT (phát hiện vân Moiré màn hình & lưới điểm ảnh).
    2. Độ phản xạ chói cục bộ & độ lệch màu sắc da trong không gian YCrCb/HSV.
    3. Độ biến thiên vi cấu trúc bề mặt (Micro-texture Laplacian & Sobel Gradient).
    4. Tỷ lệ kích thước khuôn mặt hợp lệ trong khung hình.
    """
    h_img, w_img = img.shape[:2]
    x = max(0, int(facial_area.get("x", 0)))
    y = max(0, int(facial_area.get("y", 0)))
    w = max(1, int(facial_area.get("w", w_img)))
    h = max(1, int(facial_area.get("h", h_img)))

    face_roi = img[y : min(h_img, y + h), x : min(w_img, x + w)]
    if face_roi.size == 0 or face_roi.shape[0] < 40 or face_roi.shape[1] < 40:
        return {
            "is_live": False,
            "liveness_score": 0.15,
            "reason": "Khuôn mặt quá nhỏ hoặc ở quá xa camera. Vui lòng bước lại gần hơn!",
        }

    # Chuẩn hóa kích thước ROI để tính toán ổn định
    roi_resized = cv2.resize(face_roi, (128, 128))
    gray_roi = cv2.cvtColor(roi_resized, cv2.COLOR_BGR2GRAY)

    # 1. Phân tích phổ tần số Fourier (2D FFT) phát hiện vân Moiré / màn hình điện thoại
    f_transform = np.fft.fft2(gray_roi.astype(np.float32))
    f_shift = np.fft.fftshift(f_transform)
    magnitude = np.log1p(np.abs(f_shift))
    cy, cx = 64, 64
    y_grid, x_grid = np.ogrid[:128, :128]
    dist_from_center = np.sqrt((x_grid - cx) ** 2 + (y_grid - cy) ** 2)

    low_freq_energy = np.mean(magnitude[dist_from_center <= 16])
    high_freq_energy = np.mean(magnitude[dist_from_center > 32])
    freq_ratio = float(high_freq_energy / max(low_freq_energy, 1e-5))
    # Ảnh chụp lại màn hình thường có spike tần số cao bất thường (Moiré) hoặc quá mờ mất chi tiết
    freq_score = 1.0
    if freq_ratio > 0.62:
        freq_score = max(0.1, 1.0 - (freq_ratio - 0.62) * 3.5)
    elif freq_ratio < 0.18:
        freq_score = max(0.2, freq_ratio / 0.18)

    # 2. Phân tích không gian màu YCrCb & HSV (Kiểm tra phân bố sắc tố da & vùng lóa màn hình)
    ycrcb = cv2.cvtColor(roi_resized, cv2.COLOR_BGR2YCrCb)
    _, cr, cb = cv2.split(ycrcb)
    cr_std = float(np.std(cr))
    cb_std = float(np.std(cb))
    chroma_score = np.clip((cr_std + cb_std) / 14.0, 0.2, 1.0)

    # Kiểm tra hiện tượng chói màn hình (Specular Glare trên kính điện thoại)
    hsv = cv2.cvtColor(roi_resized, cv2.COLOR_BGR2HSV)
    _, s_chan, v_chan = cv2.split(hsv)
    glare_mask = (v_chan > 245) & (s_chan < 30)
    glare_ratio = float(np.mean(glare_mask))
    glare_penalty = 0.0
    if glare_ratio > 0.12:
        glare_penalty = min(0.45, (glare_ratio - 0.12) * 2.5)

    # 3. Phân tích vi cấu trúc bề mặt (Micro-Texture Gradient)
    sobelx = cv2.Sobel(gray_roi, cv2.CV_64F, 1, 0, ksize=3)
    sobely = cv2.Sobel(gray_roi, cv2.CV_64F, 0, 1, ksize=3)
    gradient_mag = np.sqrt(sobelx**2 + sobely**2)
    texture_std = float(np.std(gradient_mag))
    texture_score = float(np.clip(texture_std / 32.0, 0.25, 1.0))

    # Tổng hợp điểm Liveness (0.0 -> 1.0)
    raw_score = (0.40 * freq_score) + (0.35 * chroma_score) + (0.25 * texture_score) - glare_penalty
    liveness_score = float(np.clip(raw_score, 0.0, 1.0))
    is_live = liveness_score >= 0.48

    reason = "Khuôn mặt thực hợp lệ"
    if not is_live:
        if glare_penalty > 0.15:
            reason = "Cảnh báo: Phát hiện phản xạ lóa từ màn hình điện thoại / bề mặt phẳng!"
        elif freq_score < 0.45:
            reason = "Cảnh báo: Phát hiện nhiễu vân màn hình (Moiré) hoặc ảnh in giả mạo!"
        else:
            reason = "Cảnh báo: Không đạt ngưỡng xác thực thực thể sống (Liveness Check Failed)!"

    return {
        "is_live": is_live,
        "liveness_score": round(liveness_score, 4),
        "reason": reason,
        "metrics": {
            "freq_ratio": round(freq_ratio, 4),
            "chroma_std": round(cr_std + cb_std, 2),
            "glare_ratio": round(glare_ratio, 4),
            "texture_std": round(texture_std, 2),
        },
    }


def generate_augmented_variants(img: np.ndarray) -> List[Tuple[str, np.ndarray]]:
    """
    Sinh các biến thể ảnh khuôn mặt (Data Augmentation) phục vụ Worker trích xuất
    Multi-Embedding giúp tăng độ chính xác khi người dùng nghiêng mặt hoặc thay đổi ánh sáng:
    1. Ảnh lật gương ngang (Horizontal Flip)
    2. Ảnh xoay góc nhẹ (+5 độ & -5 độ)
    3. Ảnh cân bằng sáng sâu (CLAHE + Contrast Boost)
    """
    variants: List[Tuple[str, np.ndarray]] = []
    h, w = img.shape[:2]
    center = (w // 2, h // 2)

    # 1. Lật ngang (Horizontal Flip)
    flipped = cv2.flip(img, 1)
    variants.append(("flip_horizontal", flipped))

    # 2. Xoay nhẹ +5 độ và -5 độ (Mô phỏng nghiêng đầu tự nhiên)
    for angle in (-5.0, 5.0):
        rot_mat = cv2.getRotationMatrix2D(center, angle, 1.0)
        rotated = cv2.warpAffine(
            img, rot_mat, (w, h), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT_101
        )
        variants.append((f"tilt_{int(angle)}deg", rotated))

    # 3. Biến thể ánh sáng dịu (Low-light simulation / Gamma)
    gamma_variant = apply_gamma_correction(img, 1.25)
    variants.append(("lighting_boost", gamma_variant))

    return variants


def detect_mask_and_ppe(img: np.ndarray, facial_area: Dict[str, int]) -> Dict[str, Any]:
    """
    Phát hiện khẩu trang y tế / trang bị bảo hộ (Face Mask & PPE Detection):
    1. Trích xuất vùng nửa dưới khuôn mặt (từ sống mũi tới cằm: mũi, miệng).
    2. Phân tích phân bố sắc tố da (Skin Color Segmentation trong YCrCb và HSV).
    3. Phân tích màu đặc trưng của khẩu trang (Xanh y tế / Cyan / Trắng N95 / Đen).
    4. Phân tích hình thái vị trí mũi và miệng để phát hiện 'Đeo khẩu trang sai quy cách' (tụt dưới mũi).
    """
    h_img, w_img = img.shape[:2]
    x = max(0, int(facial_area.get("x", 0)))
    y = max(0, int(facial_area.get("y", 0)))
    w = max(1, int(facial_area.get("w", w_img)))
    h = max(1, int(facial_area.get("h", h_img)))

    face_roi = img[y : min(h_img, y + h), x : min(w_img, x + w)]
    if face_roi.size == 0 or face_roi.shape[0] < 30 or face_roi.shape[1] < 30:
        return {
            "is_masked": False,
            "mask_status": "no_mask",
            "confidence": 0.5,
            "label": "Không xác định",
            "ppe_compliant": False,
        }

    roi_h, roi_w = face_roi.shape[:2]
    # Phân vùng nửa trên (trán, mắt) và nửa dưới (mũi, miệng, cằm)
    upper_roi = face_roi[0 : int(roi_h * 0.45), :]
    lower_roi = face_roi[int(roi_h * 0.45) : roi_h, :]
    nose_roi = face_roi[int(roi_h * 0.35) : int(roi_h * 0.65), int(roi_w * 0.25) : int(roi_w * 0.75)]
    mouth_roi = face_roi[int(roi_h * 0.65) : int(roi_h * 0.95), int(roi_w * 0.15) : int(roi_w * 0.85)]

    # 1. Phân tích tỷ lệ màu da trong YCrCb
    def get_skin_ratio(bgr_patch: np.ndarray) -> float:
        if bgr_patch.size == 0:
            return 0.0
        ycrcb = cv2.cvtColor(bgr_patch, cv2.COLOR_BGR2YCrCb)
        _, cr, cb = cv2.split(ycrcb)
        skin_mask = (cr >= 133) & (cr <= 173) & (cb >= 77) & (cb <= 127)
        return float(np.mean(skin_mask))

    upper_skin = get_skin_ratio(upper_roi)
    lower_skin = get_skin_ratio(lower_roi)
    mouth_skin = get_skin_ratio(mouth_roi)
    nose_skin = get_skin_ratio(nose_roi)

    # 2. Phân tích màu sắc đặc trưng của khẩu trang (Xanh y tế / Cyan / Trắng N95 / Đen)
    lower_hsv = cv2.cvtColor(lower_roi, cv2.COLOR_BGR2HSV)
    h_chan, s_chan, v_chan = cv2.split(lower_hsv)

    # Khẩu trang xanh y tế / xanh dương: H trong [85, 135], S > 35, V > 50
    blue_mask = (h_chan >= 85) & (h_chan <= 135) & (s_chan >= 35) & (v_chan >= 50)
    blue_ratio = float(np.mean(blue_mask))

    # Khẩu trang trắng y tế / N95: Độ bão hòa màu cực thấp S < 35, độ sáng V > 140
    white_mask = (s_chan <= 35) & (v_chan >= 140)
    white_ratio = float(np.mean(white_mask))

    # Khẩu trang đen / xám đậm: Độ sáng V < 55
    black_mask = (v_chan <= 55)
    black_ratio = float(np.mean(black_mask))

    mask_color_ratio = blue_ratio + white_ratio + black_ratio

    # 3. Đánh giá trạng thái
    is_masked = False
    mask_status = "no_mask"
    label = "Không đeo khẩu trang"
    confidence = 0.85
    ppe_compliant = False

    if mouth_skin < 0.22 and (mask_color_ratio > 0.28 or lower_skin < 0.25):
        if nose_skin > 0.45 and mouth_skin < 0.15:
            # Mũi hở nhưng miệng che -> Đeo sai quy cách
            is_masked = True
            mask_status = "improper_mask"
            label = "Đeo khẩu trang sai quy cách (tụt dưới mũi)"
            confidence = round(float(np.clip(0.65 + (nose_skin - mouth_skin) * 0.4, 0.6, 0.96)), 2)
            ppe_compliant = False
        else:
            is_masked = True
            mask_status = "mask_on"
            label = "Đã đeo khẩu trang chuẩn"
            confidence = round(
                float(np.clip(0.70 + mask_color_ratio * 0.35 + (upper_skin - lower_skin) * 0.25, 0.7, 0.98)),
                2,
            )
            ppe_compliant = True
    elif blue_ratio > 0.25 or (lower_skin < 0.30 and upper_skin > 0.45):
        is_masked = True
        mask_status = "mask_on"
        label = "Đã đeo khẩu trang"
        confidence = round(float(np.clip(0.70 + blue_ratio * 0.5, 0.65, 0.95)), 2)
        ppe_compliant = True
    else:
        is_masked = False
        mask_status = "no_mask"
        label = "Chưa đeo khẩu trang"
        confidence = round(float(np.clip(0.70 + lower_skin * 0.35, 0.65, 0.97)), 2)
        ppe_compliant = False

    return {
        "is_masked": is_masked,
        "mask_status": mask_status,
        "label": label,
        "confidence": confidence,
        "ppe_compliant": ppe_compliant,
        "metrics": {
            "lower_skin_ratio": round(lower_skin, 3),
            "upper_skin_ratio": round(upper_skin, 3),
            "mask_color_ratio": round(mask_color_ratio, 3),
        },
    }


def enhance_upper_face_for_masked(img: np.ndarray, facial_area: Dict[str, int]) -> np.ndarray:
    """Tăng cường chi tiết vùng mắt & sống mũi (Periocular Enhancement) khi đối tượng đeo khẩu trang."""
    h_img, w_img = img.shape[:2]
    x = max(0, int(facial_area.get("x", 0)))
    y = max(0, int(facial_area.get("y", 0)))
    w = max(1, int(facial_area.get("w", w_img)))
    h = max(1, int(facial_area.get("h", h_img)))

    enhanced = img.copy()
    upper_y_end = min(h_img, y + int(h * 0.6))
    upper_roi = enhanced[y:upper_y_end, x : min(w_img, x + w)]
    if upper_roi.size > 0:
        lab = cv2.cvtColor(upper_roi, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(6, 6))
        l_clahe = clahe.apply(l)
        lab_boost = cv2.merge((l_clahe, a, b))
        enhanced[y:upper_y_end, x : min(w_img, x + w)] = cv2.cvtColor(lab_boost, cv2.COLOR_LAB2BGR)
    return enhanced
