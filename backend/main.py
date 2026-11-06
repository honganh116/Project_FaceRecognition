from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
import logging
import os
import re
import secrets
from typing import Tuple

import cv2
from deepface import DeepFace
from fastapi import Depends, FastAPI, File, Form, HTTPException, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
import numpy as np
from passlib.context import CryptContext
from pydantic import BaseModel, field_validator
import redis
from rq import Queue

from database import (
    check_storage_health,
    delete_user_by_code,
    find_match_in_db,
    get_all_logs,
    get_all_users,
    get_image_from_minio,
    get_shift_time,
    init_db,
    log_attendance,
    register_user,
    update_shift_time,
)
from tasks import process_face_recognition
from vision_pipeline import (
    check_face_liveness,
    enhance_face_image,
    normalize_embedding,
)

# Cấu hình Logging chuẩn Enterprise
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
)
logger = logging.getLogger("faceid.api")

# 1. CẤU HÌNH BẢO MẬT & HẰNG SỐ HỆ THỐNG
SECRET_KEY = os.getenv("SECRET_KEY", "fallback_secret_key_do_not_use_in_prod")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60
MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024  # Giới hạn 10MB chống quá tải bộ nhớ

ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "123_default")

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/login")

# --- KHỞI TẠO KẾT NỐI HÀNG ĐỢI (MESSAGE QUEUE) ---
REDIS_HOST = os.getenv("REDIS_HOST", "redis")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
redis_conn = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, socket_connect_timeout=3)
task_queue = Queue("default", connection=redis_conn)


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


async def get_current_admin(token: str = Depends(oauth2_scheme)) -> str:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if not username or not secrets.compare_digest(username, ADMIN_USERNAME):
            raise HTTPException(status_code=401, detail="Không có quyền truy cập")
        return username
    except JWTError:
        raise HTTPException(status_code=401, detail="Phiên làm việc hết hạn")


async def decode_and_validate_image(file: UploadFile) -> Tuple[np.ndarray, bytes]:
    """
    Hàm dùng chung (DRY) để kiểm tra kích thước, định dạng và giải mã ảnh an toàn
    cho mọi API Thị giác máy tính.
    """
    contents = await file.read()
    if not contents:
        raise ValueError("File tải lên rỗng!")
    if len(contents) > MAX_IMAGE_SIZE_BYTES:
        raise ValueError("Kích thước ảnh vượt quá giới hạn cho phép (10MB)!")

    nparr = np.frombuffer(contents, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None or img.size == 0:
        raise ValueError("Không thể giải mã định dạng ảnh. Vui lòng chọn ảnh JPEG/PNG hợp lệ!")
    return img, contents


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Quản lý vòng đời ứng dụng theo chuẩn FastAPI hiện đại (thay thế @app.on_event deprecated):
    1. Khởi tạo & kiểm tra kết nối 3 tầng Database (có retry).
    2. Làm nóng (Warm-up) mô hình ArcFace 512D + SSD Detector vào RAM.
    """
    logger.info("🚀 Đang khởi tạo hạ tầng lưu trữ và nạp mô hình AI...")
    init_db()
    try:
        dummy_img = np.zeros((224, 224, 3), dtype=np.uint8)
        DeepFace.represent(
            img_path=dummy_img,
            model_name="ArcFace",
            detector_backend="ssd",
            enforce_detection=False,
            align=False,
        )
        logger.info("✅ Warm-up ArcFace 512D thành công! Server đã sẵn sàng nhận diện siêu tốc.")
    except Exception as e:
        logger.warning(f"⚠️ Cảnh báo lúc khởi động AI: {e}")
    yield
    logger.info("🛑 Đang đóng kết nối hệ thống FaceID Backend...")


# 🌟 2. KHỞI TẠO APP
app = FastAPI(
    title="Hệ thống Nhận diện Khuôn mặt AI Enterprise",
    version="2.1",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# 🌟 3. API ĐĂNG NHẬP (CHỐNG TIMING ATTACK)
@app.post("/api/login")
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    is_valid_user = secrets.compare_digest(form_data.username, ADMIN_USERNAME)
    is_valid_pass = secrets.compare_digest(form_data.password, ADMIN_PASSWORD)
    if is_valid_user and is_valid_pass:
        access_token = create_access_token(data={"sub": form_data.username})
        logger.info(f"Quản trị viên '{form_data.username}' đăng nhập thành công.")
        return {"access_token": access_token, "token_type": "bearer"}
    logger.warning(f"Cảnh báo đăng nhập thất bại với tài khoản: {form_data.username}")
    raise HTTPException(status_code=400, detail="Sai tài khoản hoặc mật khẩu")


@app.get("/")
def read_root():
    return {"message": "Server FastAPI AI Enterprise v2.1 đang hoạt động trơn tru!"}


@app.get("/health")
@app.get("/api/health")
def health_check():
    """Kiểm tra trạng thái toàn diện của cả 4 dịch vụ hạ tầng (Postgres, Qdrant, MinIO, Redis)."""
    storage_status = check_storage_health()
    try:
        redis_status = "ok" if redis_conn.ping() else "error"
    except Exception:
        redis_status = "error"

    all_ok = all(v == "ok" for v in storage_status.values()) and redis_status == "ok"
    return {
        "status": "ok" if all_ok else "degraded",
        "service": "Face Recognition Core v2.1",
        "components": {
            **storage_status,
            "redis": redis_status,
        },
        "features": [
            "ArcFace-512D-L2",
            "CLAHE-Enhancement",
            "Hybrid-AntiSpoofing",
            "Multi-Embedding-RQ",
            "Attendance-Cooldown-Deduplication",
        ],
    }


@app.get("/api/images/{image_name}")
def serve_minio_image(image_name: str):
    """Proxy tải ảnh từ MinIO giúp trình duyệt hiển thị trực tiếp qua cổng 80 của Nginx."""
    try:
        image_bytes = get_image_from_minio(image_name)
        return Response(
            content=image_bytes,
            media_type="image/jpeg",
            headers={"Cache-Control": "public, max-age=86400"},
        )
    except Exception:
        raise HTTPException(status_code=404, detail="Không tìm thấy ảnh trong kho lưu trữ MinIO")


@app.post("/api/extract")
async def extract_face(file: UploadFile = File(...)):
    try:
        img, _ = await decode_and_validate_image(file)
        enhanced_img, quality = enhance_face_image(img)

        results = DeepFace.represent(
            img_path=enhanced_img,
            model_name="ArcFace",
            detector_backend="ssd",
            enforce_detection=True,
            align=True,
        )
        embedding_vector = normalize_embedding(results[0]["embedding"])
        facial_area = results[0].get("facial_area", {})
        liveness = check_face_liveness(img, facial_area)

        return {
            "message": "AI đã trích xuất và chuẩn hóa khuôn mặt thành công!",
            "faces_detected": len(results),
            "vector_length": len(embedding_vector),
            "vector_sample": embedding_vector[:5],
            "quality": quality,
            "liveness": liveness,
        }

    except ValueError as ve:
        return {"error": str(ve) if "kích thước" in str(ve).lower() else "Không tìm thấy khuôn mặt nào trong ảnh. Vui lòng chọn ảnh rõ mặt hơn!"}
    except Exception as e:
        logger.error(f"Lỗi tại /api/extract: {e}")
        return {"error": f"Lỗi hệ thống: {str(e)}"}


@app.post("/api/verify")
async def verify_faces(file1: UploadFile = File(...), file2: UploadFile = File(...)):
    try:
        img1, _ = await decode_and_validate_image(file1)
        img2, _ = await decode_and_validate_image(file2)

        enhanced1, _ = enhance_face_image(img1)
        enhanced2, _ = enhance_face_image(img2)

        result = DeepFace.verify(
            img1_path=enhanced1,
            img2_path=enhanced2,
            model_name="ArcFace",
            detector_backend="ssd",
            enforce_detection=True,
            align=True,
        )

        return {
            "message": "So sánh thành công!",
            "is_same_person": bool(result["verified"]),
            "distance": float(result["distance"]),
            "threshold": float(result["threshold"]),
        }

    except ValueError:
        return {"error": "Không tìm thấy khuôn mặt trong 1 hoặc cả 2 bức ảnh. Vui lòng thử ảnh rõ mặt hơn!"}
    except Exception as e:
        logger.error(f"Lỗi tại /api/verify: {e}")
        return {"error": f"Lỗi hệ thống: {str(e)}"}


@app.post("/api/register")
async def register_face(
    name: str = Form(...),
    student_code: str = Form(...),
    file: UploadFile = File(...),
    admin: str = Depends(get_current_admin),
):
    try:
        if not name.strip() or not student_code.strip():
            return {"error": "Họ tên và Mã sinh viên không được để trống!"}

        img, _ = await decode_and_validate_image(file)

        # 1. Tiền xử lý ảnh (CLAHE + Gamma) & Kiểm tra chất lượng ảnh đăng ký
        enhanced_img, quality = enhance_face_image(img)
        if not quality["is_valid"] and quality["blur_score"] < 18.0:
            return {"error": f"Chất lượng ảnh quá thấp: {quality['reason']}"}

        # 2. Phát hiện và trích xuất vector gốc bằng ArcFace
        results = DeepFace.represent(
            img_path=enhanced_img,
            model_name="ArcFace",
            detector_backend="ssd",
            enforce_detection=True,
            align=True,
        )

        if len(results) > 1:
            return {"error": "Phát hiện nhiều khuôn mặt trong ảnh đăng ký! Vui lòng chọn ảnh chỉ có 1 người."}

        embedding_vector = results[0]["embedding"]

        # Mã hóa lại ảnh đã cân bằng sáng để lưu trữ chuẩn hóa trên MinIO
        _, encoded_buf = cv2.imencode(".jpg", enhanced_img, [int(cv2.IMWRITE_JPEG_QUALITY), 95])
        clean_image_bytes = encoded_buf.tobytes()

        success, msg, image_name = register_user(name, student_code, embedding_vector, clean_image_bytes)

        if success:
            # Đẩy tác vụ tăng cường dữ liệu AI (Multi-Embedding Augmentation) cho Worker chạy ngầm
            try:
                task_queue.enqueue(process_face_recognition, image_name, student_code.strip(), name.strip())
            except Exception as q_err:
                logger.warning(f"⚠️ Không thể đẩy tác vụ vào Redis Queue: {q_err}")

            return {
                "message": msg,
                "name": name.strip(),
                "student_code": student_code.strip(),
                "quality": quality,
            }
        else:
            return {"error": msg}

    except ValueError:
        return {"error": "Không tìm thấy khuôn mặt trong ảnh. Vui lòng thử ảnh rõ mặt hơn!"}
    except Exception as e:
        logger.error(f"Lỗi tại /api/register: {e}")
        return {"error": f"Lỗi hệ thống: {str(e)}"}


@app.post("/api/recognize")
async def recognize_face(file: UploadFile = File(...)):
    try:
        img, _ = await decode_and_validate_image(file)

        # 1. Tiền xử lý ảnh thông minh (CLAHE + Adaptive Gamma) & Đánh giá chất lượng
        enhanced_img, quality = enhance_face_image(img)
        if not quality["is_valid"] and quality["blur_score"] < 15.0:
            return {
                "status": "quality_error",
                "message": quality["reason"],
                "quality": quality,
            }

        # 2. Phát hiện khuôn mặt & Trích xuất Vector 512 chiều trên ảnh đã cân bằng sáng
        results = DeepFace.represent(
            img_path=enhanced_img,
            model_name="ArcFace",
            detector_backend="ssd",
            enforce_detection=True,
            align=True,
        )

        if len(results) > 1:
            return {
                "status": "warning",
                "message": "Cảnh báo: Phát hiện nhiều khuôn mặt. Vui lòng quét từng người!",
            }

        target_embedding = results[0]["embedding"]
        facial_area = results[0].get("facial_area", {})
        box = {
            "x": facial_area.get("x", 0),
            "y": facial_area.get("y", 0),
            "w": facial_area.get("w", 0),
            "h": facial_area.get("h", 0),
        }

        # 3. Kiểm tra chống giả mạo (Hybrid Face Anti-Spoofing / Liveness Check)
        liveness = check_face_liveness(img, box)
        if not liveness["is_live"]:
            logger.warning(f"Chặn nghi vấn giả mạo khuôn mặt (score={liveness['liveness_score']})")
            return {
                "status": "spoof",
                "message": liveness["reason"],
                "liveness": liveness,
                "quality": quality,
                "box": box,
            }

        # 4. Đối sánh Vector chuẩn hóa L2 với cơ chế Multi-Embedding Consensus trong Qdrant
        found, match_info, similarity_score = find_match_in_db(target_embedding)

        if found:
            attendance_info = log_attendance(match_info["name"], match_info["student_code"])
            return {
                "status": "success",
                "message": "Xin chào người quen!",
                "user": match_info,
                "attendance": attendance_info,
                "distance": round(similarity_score, 4),
                "confidence": round(similarity_score * 100, 1),
                "liveness": liveness,
                "quality": quality,
                "box": box,
            }
        else:
            return {
                "status": "unknown",
                "message": "Cảnh báo: Phát hiện người lạ!",
                "distance": round(similarity_score, 4) if similarity_score else None,
                "liveness": liveness,
                "quality": quality,
                "box": box,
            }

    except ValueError:
        return {"status": "error", "message": "Không tìm thấy khuôn mặt trong ảnh!"}
    except Exception as e:
        logger.error(f"Lỗi tại /api/recognize: {e}")
        return {"status": "error", "message": f"Lỗi hệ thống: {str(e)}"}


@app.get("/api/logs")
def view_attendance_logs(admin: str = Depends(get_current_admin)):
    logs = get_all_logs()
    return {
        "message": "Danh sách điểm danh",
        "total_records": len(logs),
        "data": logs,
    }


@app.get("/api/users")
def view_all_users(admin: str = Depends(get_current_admin)):
    users = get_all_users()
    return {
        "message": "Danh sách nhân sự",
        "total_records": len(users),
        "data": users,
    }


# --- API LƯU CẤU HÌNH GIỜ VÀO CA (CÓ VALIDATION ĐỊNH DẠNG HH:MM) ---
class ShiftTimeUpdate(BaseModel):
    shift_time: str

    @field_validator("shift_time")
    @classmethod
    def validate_hh_mm(cls, v: str) -> str:
        if not re.match(r"^([01]\d|2[0-3]):([0-5]\d)$", v.strip()):
            raise ValueError("Giờ vào ca phải đúng định dạng HH:MM (ví dụ: 08:00)")
        return v.strip()


@app.get("/api/settings/shift-time")
def get_shift_time_api():
    return {"shift_time": get_shift_time()}


@app.post("/api/settings/shift-time")
def update_shift_time_api(data: ShiftTimeUpdate, admin: str = Depends(get_current_admin)):
    update_shift_time(data.shift_time)
    return {"message": "Cập nhật giờ vào ca thành công!", "shift_time": data.shift_time}


@app.delete("/api/users/{student_code}")
def remove_user(student_code: str, admin: str = Depends(get_current_admin)):
    success, msg = delete_user_by_code(student_code)
    if success:
        return {"message": msg}
    raise HTTPException(status_code=404, detail=msg)
