import sqlite3
import datetime
import uuid # Dùng để tạo mã ID tự động cho Qdrant
import json
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct

DB_FILE = "face_database.db"

# ==========================================
# 1. CẤU HÌNH QDRANT (LƯU VECTOR KHUÔN MẶT)
# ==========================================
qdrant_client = QdrantClient("localhost", port=6333)
COLLECTION_NAME = "faces_db"

if not qdrant_client.collection_exists(COLLECTION_NAME):
    qdrant_client.create_collection(
        collection_name=COLLECTION_NAME,
        vectors_config=VectorParams(size=128, distance=Distance.COSINE),
    )
    print(f"✅ Đã tạo mới bộ nhớ Vector: '{COLLECTION_NAME}'")

def register_user(name, student_code, embedding):
    """Lưu khuôn mặt trực tiếp vào Qdrant"""
    point_id = str(uuid.uuid4()) # Qdrant cần 1 cái ID dạng chuỗi ngẫu nhiên
    
    qdrant_client.upsert(
        collection_name=COLLECTION_NAME,
        points=[
            PointStruct(
                id=point_id,
                vector=embedding,
                payload={"name": name, "student_code": student_code}
            )
        ]
    )
    return True, "Đăng ký thành công vào Vector DB!"

def find_match_in_db(target_embedding):
    """Tìm khuôn mặt bằng Qdrant siêu tốc"""
    search_result = qdrant_client.query_points(
        collection_name=COLLECTION_NAME,
        query=target_embedding,
        limit=1
    )
    
    # Nếu trong Database chưa có ai thì báo lỗi
    if not search_result.points:
        return False, None, 0
        
    best_match = search_result.points[0]
    score = best_match.score # Điểm tương đồng: Từ 0 đến 1 (1 là giống hệt)
    
    # Đặt ngưỡng: Điểm > 0.6 là nhận diện thành công
    if score > 0.6:
        match_info = {
            "name": best_match.payload["name"],
            "student_code": best_match.payload["student_code"]
        }
        return True, match_info, score
    else:
        return False, None, score

# ==========================================
# 2. CẤU HÌNH SQLITE (LÀM SỔ CHẤM CÔNG)
# ==========================================
def init_db():
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS attendance (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            student_code TEXT NOT NULL,
            time_logged TEXT NOT NULL
        )
    ''')
    conn.commit()
    conn.close()

def log_attendance(name, student_code):
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    current_time = datetime.datetime.now().strftime("%d/%m/%Y %H:%M:%S")
    cursor.execute('INSERT INTO attendance (name, student_code, time_logged) VALUES (?, ?, ?)',
                   (name, student_code, current_time))
    conn.commit()
    conn.close()

def get_all_logs():
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute("SELECT name, student_code, time_logged FROM attendance ORDER BY id DESC LIMIT 50")
    rows = cursor.fetchall()
    conn.close()
    return [{"name": r[0], "student_code": r[1], "time": r[2]} for r in rows]