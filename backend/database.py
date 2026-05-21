import os
import uuid
import json
from datetime import datetime, timedelta
import io

from sqlalchemy import create_engine, Column, Integer, String
from sqlalchemy.orm import declarative_base, sessionmaker
from qdrant_client import QdrantClient
from qdrant_client.models import PointStruct, VectorParams, Distance, Filter, FieldCondition, MatchValue
from minio import Minio

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

# 2. KHỞI TẠO KẾT NỐI
DATABASE_URL = f"postgresql://{PG_USER}:{PG_PASS}@{PG_HOST}:{PG_PORT}/{PG_DB}"
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Tên bảng đổi thành face_profiles để không đụng hàng với bạn Bình
class FaceProfile(Base):
    __tablename__ = "face_profiles" 
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    student_code = Column(String, unique=True, index=True)
    image_url = Column(String)

class Attendance(Base):
    __tablename__ = "attendance"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    student_code = Column(String)
    time_logged = Column(String)
    status = Column(String, default="Đúng giờ")

class Settings(Base):
    __tablename__ = "settings"
    key = Column(String, primary_key=True, index=True)
    value = Column(String)

minio_client = Minio(MINIO_ENDPOINT, access_key=MINIO_ACCESS, secret_key=MINIO_SECRET, secure=False)
BUCKET_NAME = "face-images"
qdrant_client = QdrantClient(host=QDRANT_HOST, port=QDRANT_PORT)
COLLECTION_NAME = "face_embeddings"

# 3. CÁC HÀM XỬ LÝ LÕI
def init_db():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    if not db.query(Settings).filter(Settings.key == "shift_time").first():
        db.add(Settings(key="shift_time", value="08:00"))
        db.commit()
    db.close()

    if not minio_client.bucket_exists(BUCKET_NAME):
        minio_client.make_bucket(BUCKET_NAME)

    try:
        qdrant_client.get_collection(COLLECTION_NAME)
    except Exception:
        qdrant_client.recreate_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=VectorParams(size=512, distance=Distance.COSINE),
        )
    print("✅ Hạ tầng Enterprise đã khởi động thành công!")

def get_shift_time():
    db = SessionLocal()
    setting = db.query(Settings).filter(Settings.key == "shift_time").first()
    db.close()
    return setting.value if setting else "08:00"

def update_shift_time(new_time):
    db = SessionLocal()
    setting = db.query(Settings).filter(Settings.key == "shift_time").first()
    if setting:
        setting.value = new_time
    else:
        db.add(Settings(key="shift_time", value=new_time))
    db.commit()
    db.close()

# Nhận thêm tham số image_bytes để lưu ảnh
def register_user(name, student_code, embedding_vector, image_bytes):
    db = SessionLocal()
    if db.query(FaceProfile).filter(FaceProfile.student_code == student_code).first():
        db.close()
        return False, "Lỗi: Mã sinh viên đã tồn tại!"
    
    # Ném ảnh lên MinIO
    image_name = f"{student_code}_{uuid.uuid4().hex}.jpg"
    minio_client.put_object(BUCKET_NAME, image_name, io.BytesIO(image_bytes), len(image_bytes), content_type="image/jpeg")
    image_url = f"http://{MINIO_ENDPOINT}/{BUCKET_NAME}/{image_name}"

    # Lưu thông tin vào Postgres
    new_user = FaceProfile(name=name, student_code=student_code, image_url=image_url)
    db.add(new_user)
    db.commit()
    db.close()

    # Lưu Vector vào Qdrant
    point_id = str(uuid.uuid4())
    qdrant_client.upsert(
        collection_name=COLLECTION_NAME,
        points=[PointStruct(id=point_id, vector=embedding_vector, payload={"name": name, "student_code": student_code})]
    )
    return True, "Đăng ký khuôn mặt thành công!"

def find_match_in_db(target_embedding, threshold_score=0.45):
    # Đổi sang dùng query_points theo chuẩn Qdrant mới nhất
    search_result = qdrant_client.query_points(
        collection_name=COLLECTION_NAME,
        query=target_embedding,
        limit=1
    )
    
    # Kiểm tra xem có kết quả trả về không
    if search_result and search_result.points:
        best_match = search_result.points[0]
        # Phiên bản mới dùng thuộc tính score trực tiếp
        if best_match.score >= threshold_score:
            return True, best_match.payload, best_match.score
        return False, None, best_match.score
        
    return False, None, 0

def log_attendance(name, student_code):
    db = SessionLocal()
    now = datetime.now()
    current_time_str = now.strftime("%d/%m/%Y %H:%M:%S")
    time_only = now.strftime("%H:%M")
    status = "Đi muộn" if time_only > get_shift_time() else "Đúng giờ"
    
    db.add(Attendance(name=name, student_code=student_code, time_logged=current_time_str, status=status))
    
    # --- LOGIC TỰ ĐỘNG XÓA LỊCH SỬ QUÁ 45 NGÀY ---
    cutoff_date = now - timedelta(days=45)
    all_logs = db.query(Attendance).all()
    for log in all_logs:
        try:
            # Dịch chuỗi chữ ngược lại thành kiểu thời gian để so sánh
            log_time = datetime.strptime(log.time_logged, "%d/%m/%Y %H:%M:%S")
            if log_time < cutoff_date:
                db.delete(log)
        except ValueError:
            pass # Bỏ qua nếu có dòng log nào bị lỗi định dạng

    db.commit()
    db.close()

def get_all_logs():
    db = SessionLocal()
    logs = db.query(Attendance).order_by(Attendance.id.desc()).limit(50).all()
    db.close()
    return [{"name": l.name, "student_code": l.student_code, "time": l.time_logged, "status": l.status} for l in logs]

def delete_user_by_code(student_code):
    db = SessionLocal()
    # Tìm xem sinh viên có tồn tại trong Postgres không
    user = db.query(FaceProfile).filter(FaceProfile.student_code == student_code).first()
    if not user:
        db.close()
        return False, "Không tìm thấy mã sinh viên này!"

    # 1. XÓA ẢNH TRÊN MINIO
    image_name = user.image_url.split('/')[-1] # Tách lấy tên file từ đường link URL
    try:
        minio_client.remove_object(BUCKET_NAME, image_name)
    except Exception as e:
        print(f"Lỗi xóa MinIO: {e}")

    # 2. XÓA BỘ NÃO TRONG QDRANT
    try:
        qdrant_client.delete(
            collection_name=COLLECTION_NAME,
            points_selector=Filter(
                must=[FieldCondition(key="student_code", match=MatchValue(value=student_code))]
            )
        )
    except Exception as e:
        print(f"Lỗi xóa Qdrant: {e}")

    # 3. XÓA THÔNG TIN TRONG POSTGRES
    db.delete(user)
    db.commit()
    db.close()

    return True, f"Đã xóa sạch sẽ toàn bộ dữ liệu của {student_code}!"

def get_all_users():
    db = SessionLocal()
    # Lấy danh sách từ bảng FaceProfile (Bảng chứa dữ liệu nhân sự đã đăng ký)
    users = db.query(FaceProfile).order_by(FaceProfile.id.desc()).all()
    db.close()
    return [{"id": u.id, "name": u.name, "student_code": u.student_code, "image_url": u.image_url} for u in users]