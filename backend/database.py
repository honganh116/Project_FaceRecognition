import sqlite3
import json

# Tên file cơ sở dữ liệu sẽ tự động được tạo
DB_FILE = "face_database.db"

def init_db():
    """Hàm này chạy lần đầu để tạo bảng dữ liệu"""
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            student_code TEXT NOT NULL UNIQUE,
            embedding TEXT NOT NULL
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