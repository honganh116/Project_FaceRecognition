import time

def process_face_recognition(image_path, user_id):
    print(f"[WORKER] Bắt đầu xử lý ảnh {image_path} cho User {user_id}...")
    
    # Giả lập model AI chạy mất 3 giây
    time.sleep(3) 
    
    print(f"[WORKER] Trích xuất Vector xong! Đã lưu vào Qdrant và Postgres.")
    return True