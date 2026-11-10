import os
import uuid
import time
import logging
from contextlib import contextmanager
from datetime import datetime, timedelta
import io
from typing import Tuple, Optional, List, Dict, Any

from sqlalchemy import create_engine, Column, Integer, String, DateTime, Float
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from sqlalchemy.sql import text
from qdrant_client import QdrantClient
from qdrant_client.models import (
    PointStruct,
    VectorParams,
    Distance,
    Filter,
    FieldCondition,
    MatchValue,
)
from minio import Minio
from vision_pipeline import normalize_embedding

# Cấu hình Logging chuẩn Enterprise
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
)
logger = logging.getLogger("faceid.database")

# 1. CẤU HÌNH BIẾN MÔI TRƯỜNG TỪ DOCKER
PG_USER = os.getenv("POSTGRES_USER", "admin")
PG_PASS = os.getenv("POSTGRES_PASSWORD", "password")
PG_DB = os.getenv("POSTGRES_DB", "ai_project")
PG_HOST = os.getenv("POSTGRES_HOST", "postgres")
PG_PORT = os.getenv("POSTGRES_PORT", "5432")

QDRANT_HOST = os.getenv("QDRANT_HOST", "qdrant")
QDRANT_PORT = int(os.getenv("QDRANT_PORT", 6333))

MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT", "minio:9000")
MINIO_ACCESS = os.getenv("MINIO_ACCESS_KEY", "admin")
MINIO_SECRET = os.getenv("MINIO_SECRET_KEY", "password123")

ATTENDANCE_COOLDOWN_SECONDS = int(os.getenv("ATTENDANCE_COOLDOWN_SECONDS", "60"))
RETENTION_DAYS = int(os.getenv("RETENTION_DAYS", "45"))

# 2. KHỞI TẠO KẾT NỐI VỚI CONNECTION POOLING AN TOÀN
DATABASE_URL = f"postgresql://{PG_USER}:{PG_PASS}@{PG_HOST}:{PG_PORT}/{PG_DB}"
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
    pool_recycle=1800,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


@contextmanager
def get_db_session() -> Session:
    """
    Context Manager quản lý vòng đời Database Session an toàn:
    Tự động rollback khi có ngoại lệ và luôn đóng kết nối tránh rò rỉ (Connection Leak).
    """
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


class FaceProfile(Base):
    __tablename__ = "face_profiles"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    student_code = Column(String, unique=True, index=True, nullable=False)
    image_url = Column(String, nullable=False)


class Attendance(Base):
    __tablename__ = "attendance"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    student_code = Column(String, index=True, nullable=False)
    time_logged = Column(String, nullable=False)
    status = Column(String, default="Đúng giờ")
    check_type = Column(String, default="Check-in")
    work_hours = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.now, index=True)


class Settings(Base):
    __tablename__ = "settings"
    key = Column(String, primary_key=True, index=True)
    value = Column(String, nullable=False)


minio_client = Minio(
    MINIO_ENDPOINT,
    access_key=MINIO_ACCESS,
    secret_key=MINIO_SECRET,
    secure=False,
)
BUCKET_NAME = "face-images"
qdrant_client = QdrantClient(host=QDRANT_HOST, port=QDRANT_PORT)
COLLECTION_NAME = "face_embeddings"


# 3. CÁC HÀM XỬ LÝ LÕI (CORE REPOSITORY)
def init_db(max_retries: int = 5, retry_delay: float = 2.0) -> None:
    """
    Khởi tạo toàn bộ 3 tầng lưu trữ (PostgreSQL, MinIO, Qdrant)
    kèm cơ chế Retry tự động chờ các container sẵn sàng khi mới bật Docker.
    """
    for attempt in range(1, max_retries + 1):
        try:
            Base.metadata.create_all(bind=engine)
            # Auto-Migration nhẹ đảm bảo tương thích với bảng attendance cũ
            with engine.begin() as conn:
                conn.execute(
                    text(
                        "ALTER TABLE attendance ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;"
                    )
                )
                conn.execute(
                    text(
                        "ALTER TABLE attendance ADD COLUMN IF NOT EXISTS check_type VARCHAR(30) DEFAULT 'Check-in';"
                    )
                )
                conn.execute(
                    text(
                        "ALTER TABLE attendance ADD COLUMN IF NOT EXISTS work_hours FLOAT DEFAULT 0.0;"
                    )
                )

            with get_db_session() as db:
                if not db.query(Settings).filter(Settings.key == "shift_time").first():
                    db.add(Settings(key="shift_time", value="08:00"))
                if not db.query(Settings).filter(Settings.key == "shift_end_time").first():
                    db.add(Settings(key="shift_end_time", value="17:30"))

            if not minio_client.bucket_exists(BUCKET_NAME):
                minio_client.make_bucket(BUCKET_NAME)

            try:
                qdrant_client.get_collection(COLLECTION_NAME)
            except Exception:
                qdrant_client.recreate_collection(
                    collection_name=COLLECTION_NAME,
                    vectors_config=VectorParams(size=512, distance=Distance.COSINE),
                )

            logger.info("✅ Hạ tầng Polyglot Storage (Postgres, Qdrant, MinIO) đã sẵn sàng!")
            return
        except Exception as err:
            logger.warning(
                f"⏳ Đang chờ Database khởi động (Lần thử {attempt}/{max_retries}): {err}"
            )
            if attempt == max_retries:
                logger.error("❌ Không thể kết nối đầy đủ tới hạ tầng lưu trữ sau nhiều lần thử!")
                raise
            time.sleep(retry_delay)


def check_storage_health() -> Dict[str, str]:
    """Kiểm tra trạng thái kết nối thực tế của từng dịch vụ lưu trữ."""
    health = {"postgres": "error", "qdrant": "error", "minio": "error"}
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        health["postgres"] = "ok"
    except Exception as e:
        logger.warning(f"Healthcheck Postgres lỗi: {e}")

    try:
        qdrant_client.get_collection(COLLECTION_NAME)
        health["qdrant"] = "ok"
    except Exception as e:
        logger.warning(f"Healthcheck Qdrant lỗi: {e}")

    try:
        if minio_client.bucket_exists(BUCKET_NAME):
            health["minio"] = "ok"
    except Exception as e:
        logger.warning(f"Healthcheck MinIO lỗi: {e}")

    return health


def get_shift_time() -> str:
    with get_db_session() as db:
        setting = db.query(Settings).filter(Settings.key == "shift_time").first()
        return setting.value if setting else "08:00"


def update_shift_time(new_time: str) -> None:
    with get_db_session() as db:
        setting = db.query(Settings).filter(Settings.key == "shift_time").first()
        if setting:
            setting.value = new_time
        else:
            db.add(Settings(key="shift_time", value=new_time))
    logger.info(f"Đã cập nhật giờ vào ca mới: {new_time}")


def register_user(
    name: str,
    student_code: str,
    embedding_vector: List[float],
    image_bytes: bytes,
) -> Tuple[bool, str, Optional[str]]:
    clean_code = student_code.strip()
    clean_name = name.strip()

    with get_db_session() as db:
        if db.query(FaceProfile).filter(FaceProfile.student_code == clean_code).first():
            return False, "Lỗi: Mã sinh viên đã tồn tại!", None

        # 1. Lưu ảnh gốc lên MinIO
        image_name = f"{clean_code}_{uuid.uuid4().hex}.jpg"
        minio_client.put_object(
            BUCKET_NAME,
            image_name,
            io.BytesIO(image_bytes),
            len(image_bytes),
            content_type="image/jpeg",
        )
        image_url = f"/api/images/{image_name}"

        # 2. Lưu thông tin vào Postgres
        new_user = FaceProfile(name=clean_name, student_code=clean_code, image_url=image_url)
        db.add(new_user)

    # 3. Chuẩn hóa L2 và lưu Vector gốc vào Qdrant
    norm_vector = normalize_embedding(embedding_vector)
    point_id = str(uuid.uuid4())
    qdrant_client.upsert(
        collection_name=COLLECTION_NAME,
        points=[
            PointStruct(
                id=point_id,
                vector=norm_vector,
                payload={"name": clean_name, "student_code": clean_code, "variant": "original"},
            )
        ],
    )
    logger.info(f"Đã đăng ký nhân sự mới: {clean_name} ({clean_code})")
    return True, "Đăng ký khuôn mặt thành công!", image_name


def upsert_augmented_embedding(
    name: str, student_code: str, embedding_vector: List[float], variant: str
) -> None:
    """Lưu thêm các vector tăng cường (Multi-Embedding) từ Background Worker vào Qdrant."""
    norm_vector = normalize_embedding(embedding_vector)
    point_id = str(uuid.uuid4())
    qdrant_client.upsert(
        collection_name=COLLECTION_NAME,
        points=[
            PointStruct(
                id=point_id,
                vector=norm_vector,
                payload={"name": name, "student_code": student_code, "variant": variant},
            )
        ],
    )


def get_image_from_minio(image_name: str) -> bytes:
    """Đọc bytes ảnh từ MinIO an toàn (chống Path Traversal)."""
    safe_name = os.path.basename(image_name)
    response = minio_client.get_object(BUCKET_NAME, safe_name)
    try:
        return response.read()
    finally:
        response.close()
        response.release_conn()


def find_match_in_db(
    target_embedding: List[float], threshold_score: float = 0.45
) -> Tuple[bool, Optional[Dict[str, Any]], float]:
    norm_target = normalize_embedding(target_embedding)
    search_result = qdrant_client.query_points(
        collection_name=COLLECTION_NAME,
        query=norm_target,
        limit=3,
    )

    if search_result and search_result.points:
        best_match = search_result.points[0]
        top_score = float(best_match.score)

        # Kiểm tra sự đồng thuận đa vector (Multi-Embedding Consensus)
        same_person_hits = [
            p
            for p in search_result.points
            if p.payload.get("student_code") == best_match.payload.get("student_code")
            and p.score >= (threshold_score - 0.03)
        ]
        consensus_bonus = 0.02 if len(same_person_hits) >= 2 else 0.0
        final_score = min(1.0, top_score + consensus_bonus)

        if final_score >= threshold_score:
            return True, best_match.payload, final_score
        return False, None, final_score

    return False, None, 0.0


def log_attendance(name: str, student_code: str) -> Dict[str, Any]:
    """
    Nghiệp vụ Chấm công Thông minh (Check-in / Check-out & Tính giờ làm):
    1. Chống spam liên tiếp trong vòng 60 giây (Cooldown).
    2. Nếu chưa có bản ghi nào trong ngày hôm nay -> Ghi nhận 'Check-in' (Đúng giờ / Đi muộn).
    3. Nếu đã có 'Check-in' trong ngày -> Tự động ghi nhận 'Check-out' (Tan ca) và tính tổng số giờ làm việc (work_hours).
    4. Tự động dọn dẹp dữ liệu quá 45 ngày bằng truy vấn SQL trực tiếp.
    """
    now = datetime.now()
    current_time_str = now.strftime("%d/%m/%Y %H:%M:%S")
    today_prefix = now.strftime("%d/%m/%Y")
    time_only = now.strftime("%H:%M")
    shift_time = get_shift_time()

    with get_db_session() as db:
        # 1. Kiểm tra Cooldown chống ghi trùng liên tiếp trong vòng 60 giây
        recent_cutoff = now - timedelta(seconds=ATTENDANCE_COOLDOWN_SECONDS)
        recent_log = (
            db.query(Attendance)
            .filter(
                Attendance.student_code == student_code,
                Attendance.created_at >= recent_cutoff,
            )
            .order_by(Attendance.id.desc())
            .first()
        )
        if recent_log:
            return {
                "is_duplicate": True,
                "time_logged": recent_log.time_logged,
                "status": recent_log.status,
                "check_type": recent_log.check_type or "Check-in",
                "work_hours": recent_log.work_hours or 0.0,
            }

        # 2. Kiểm tra xem hôm nay nhân sự đã Check-in chưa
        first_today_log = (
            db.query(Attendance)
            .filter(
                Attendance.student_code == student_code,
                Attendance.time_logged.like(f"{today_prefix}%"),
            )
            .order_by(Attendance.id.asc())
            .first()
        )

        if not first_today_log:
            check_type = "Check-in"
            status = "Đi muộn" if time_only > shift_time else "Đúng giờ"
            work_hours = 0.0
        else:
            check_type = "Check-out"
            checkin_time = first_today_log.created_at or now
            elapsed_hours = max(0.01, (now - checkin_time).total_seconds() / 3600.0)
            work_hours = round(elapsed_hours, 2)
            status = "Tan ca"

        db.add(
            Attendance(
                name=name,
                student_code=student_code,
                time_logged=current_time_str,
                status=status,
                check_type=check_type,
                work_hours=work_hours,
                created_at=now,
            )
        )

        # 3. Xóa nhanh các bản ghi quá 45 ngày bằng SQL trực tiếp
        cutoff_date = now - timedelta(days=RETENTION_DAYS)
        db.query(Attendance).filter(Attendance.created_at < cutoff_date).delete(
            synchronize_session=False
        )

    logger.info(
        f"Điểm danh [{check_type}]: {name} ({student_code}) - {status} ({work_hours}h) lúc {current_time_str}"
    )
    return {
        "is_duplicate": False,
        "time_logged": current_time_str,
        "status": status,
        "check_type": check_type,
        "work_hours": work_hours,
    }


def get_all_logs(limit: int = 200) -> List[Dict[str, Any]]:
    with get_db_session() as db:
        logs = db.query(Attendance).order_by(Attendance.id.desc()).limit(limit).all()
        return [
            {
                "name": l.name,
                "student_code": l.student_code,
                "time": l.time_logged,
                "status": l.status,
                "check_type": l.check_type or "Check-in",
                "work_hours": round(float(l.work_hours or 0.0), 2),
            }
            for l in logs
        ]


def get_employee_summary(student_code: str) -> Optional[Dict[str, Any]]:
    """Tra cứu hồ sơ cá nhân & thống kê chấm công cho Cổng Nhân sự Tự phục vụ (Self-Service App)."""
    clean_code = student_code.strip()
    with get_db_session() as db:
        profile = (
            db.query(FaceProfile)
            .filter(FaceProfile.student_code == clean_code)
            .first()
        )
        if not profile:
            return None

        logs = (
            db.query(Attendance)
            .filter(Attendance.student_code == clean_code)
            .order_by(Attendance.id.desc())
            .limit(60)
            .all()
        )

        img_url = profile.image_url or ""
        if img_url and not img_url.startswith("/api/images/"):
            img_url = f"/api/images/{os.path.basename(img_url)}"

        total_checkins = sum(1 for l in logs if (l.check_type or "Check-in") == "Check-in")
        late_count = sum(1 for l in logs if l.status == "Đi muộn")
        on_time_count = sum(1 for l in logs if l.status == "Đúng giờ")
        total_hours = round(sum(float(l.work_hours or 0.0) for l in logs), 2)

        return {
            "name": profile.name,
            "student_code": profile.student_code,
            "image_url": img_url,
            "stats": {
                "total_scans": len(logs),
                "total_checkins": total_checkins,
                "on_time_count": on_time_count,
                "late_count": late_count,
                "total_work_hours": total_hours,
            },
            "recent_logs": [
                {
                    "time": l.time_logged,
                    "status": l.status,
                    "check_type": l.check_type or "Check-in",
                    "work_hours": round(float(l.work_hours or 0.0), 2),
                }
                for l in logs[:20]
            ],
        }


def delete_user_by_code(student_code: str) -> Tuple[bool, str]:
    with get_db_session() as db:
        user = (
            db.query(FaceProfile)
            .filter(FaceProfile.student_code == student_code)
            .first()
        )
        if not user:
            return False, "Không tìm thấy mã sinh viên này!"

        image_name = os.path.basename(user.image_url)
        db.delete(user)

    # 1. Xóa ảnh trên MinIO
    try:
        minio_client.remove_object(BUCKET_NAME, image_name)
    except Exception as e:
        logger.warning(f"Lỗi xóa ảnh MinIO ({image_name}): {e}")

    # 2. Xóa toàn bộ Vector (Gốc + Augmented) trong Qdrant
    try:
        qdrant_client.delete(
            collection_name=COLLECTION_NAME,
            points_selector=Filter(
                must=[
                    FieldCondition(
                        key="student_code", match=MatchValue(value=student_code)
                    )
                ]
            ),
        )
    except Exception as e:
        logger.warning(f"Lỗi xóa vector Qdrant ({student_code}): {e}")

    logger.info(f"Đã xóa nhân sự {student_code} trên cả 3 tầng lưu trữ.")
    return True, f"Đã xóa sạch sẽ toàn bộ dữ liệu của {student_code}!"


def get_all_users() -> List[Dict[str, Any]]:
    with get_db_session() as db:
        users = db.query(FaceProfile).order_by(FaceProfile.id.desc()).all()
        result = []
        for u in users:
            img_url = u.image_url or ""
            if img_url and not img_url.startswith("/api/images/"):
                filename = os.path.basename(img_url)
                img_url = f"/api/images/{filename}"
            result.append(
                {
                    "id": u.id,
                    "name": u.name,
                    "student_code": u.student_code,
                    "image_url": img_url,
                }
            )
        return result
