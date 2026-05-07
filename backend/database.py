import sqlite3
import json
import datetime
import numpy as np 

# Tên file cơ sở dữ liệu sẽ tự động được tạo
DB_FILE = "face_database.db"

def init_db():
    """Hàm này chạy lần đầu để tạo bảng dữ liệu"""
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    # Bảng 1: Lưu thông tin khuôn mặt (Cũ)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            student_code TEXT NOT NULL UNIQUE,
            embedding TEXT NOT NULL
        )
    ''')
    
    # Bảng 2: Sổ chấm công (THÊM MỚI)
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

def register_user(name, student_code, embedding_vector):
    """Hàm này dùng để lưu Tên, Mã SV và Vector khuôn mặt vào DB"""
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    # Vector là 1 mảng số, ta phải biến nó thành chuỗi JSON để lưu vào SQLite
    embedding_json = json.dumps(embedding_vector)
    
    try:
        cursor.execute('INSERT INTO users (name, student_code, embedding) VALUES (?, ?, ?)',
                       (name, student_code, embedding_json))
        conn.commit()
        return True, "Đăng ký khuôn mặt thành công!"
    except sqlite3.IntegrityError:
        return False, "Lỗi: Mã sinh viên này đã tồn tại trong hệ thống!"
    finally:
        conn.close()
        
def cosine_distance(vec1, vec2):
    """Hàm toán học tính khoảng cách giữa 2 khuôn mặt"""
    vec1 = np.array(vec1)
    vec2 = np.array(vec2)
    return 1 - np.dot(vec1, vec2) / (np.linalg.norm(vec1) * np.linalg.norm(vec2))

def find_match_in_db(target_embedding, threshold=0.55):
    """Lục tìm khuôn mặt giống nhất trong Database. 
    Với model ArcFace, khoảng cách < 0.55 được coi là cùng 1 người."""
    
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute("SELECT name, student_code, embedding FROM users")
    rows = cursor.fetchall()
    conn.close()

    best_match = None
    min_distance = float('inf')

    # Duyệt qua từng người trong DB để so sánh
    for row in rows:
        name = row[0]
        student_code = row[1]
        db_embedding = json.loads(row[2]) # Giải mã chuỗi JSON thành mảng số

        # Đo khoảng cách
        dist = cosine_distance(target_embedding, db_embedding)

        # Cập nhật nếu tìm thấy khoảng cách nhỏ hơn
        if dist < min_distance:
            min_distance = dist
            best_match = {"name": name, "student_code": student_code}

    # Nếu khoảng cách của người giống nhất vẫn nhỏ hơn ngưỡng cho phép (0.40) -> Nhận diện thành công
    if best_match and min_distance <= threshold:
        return True, best_match, min_distance
    else:
        return False, None, min_distance
    
def log_attendance(name, student_code):
    """Ghi nhận thời gian người dùng xuất hiện trước Camera"""
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    # Lấy ngày giờ hiện tại
    current_time = datetime.datetime.now().strftime("%d/%m/%Y %H:%M:%S")
    
    cursor.execute('INSERT INTO attendance (name, student_code, time_logged) VALUES (?, ?, ?)',
                   (name, student_code, current_time))
    conn.commit()
    conn.close()

def get_all_logs():
    """Lấy danh sách 50 lượt chấm công gần nhất"""
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute("SELECT name, student_code, time_logged FROM attendance ORDER BY id DESC LIMIT 50")
    rows = cursor.fetchall()
    conn.close()
    
    # Trình bày lại cho đẹp
    return [{"name": r[0], "student_code": r[1], "time": r[2]} for r in rows]