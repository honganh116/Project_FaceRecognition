from fastapi import FastAPI, File, UploadFile
from deepface import DeepFace
import cv2
import numpy as np

# Khởi tạo app
app = FastAPI(title="Hệ thống Nhận diện Khuôn mặt", version="1.0")

@app.get("/")
def read_root():
    return {"message": "Server FastAPI đang hoạt động trơn tru!"}

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "Face Recognition Core"}

# API nạp ảnh và trích xuất khuôn mặt
@app.post("/api/extract")
async def extract_face(file: UploadFile = File(...)):
    try:
        # 1. Đọc file ảnh người dùng upload thẳng vào bộ nhớ
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        # 2. Dùng DeepFace trích xuất vector đặc trưng (Embedding)
        # Sử dụng model Facenet (rất nhẹ và chính xác)
        results = DeepFace.represent(img_path=img, model_name="Facenet", enforce_detection=True)

        # Trích xuất mảng vector của khuôn mặt đầu tiên tìm thấy
        embedding_vector = results[0]["embedding"]

        # 3. Trả về kết quả
        return {
            "message": "AI đã nhìn thấy khuôn mặt thành công!",
            "faces_detected": len(results), # Số khuôn mặt tìm thấy
            "vector_length": len(embedding_vector), # Độ dài của mảng vector (Facenet thường là 128 hoặc 512)
            "vector_sample": embedding_vector[:5] # Chỉ in ra 5 số đầu tiên cho gọn màn hình
        }
    
    except ValueError:
        return {"error": "Không tìm thấy khuôn mặt nào trong ảnh. Vui lòng chọn ảnh rõ mặt hơn!"}
    except Exception as e:
        return {"error": f"Lỗi hệ thống: {str(e)}"}