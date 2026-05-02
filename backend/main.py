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

# --- NGÀY 2: API nạp ảnh và trích xuất khuôn mặt ---
@app.post("/api/extract")
async def extract_face(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        results = DeepFace.represent(img_path=img, model_name="Facenet", enforce_detection=True)
        embedding_vector = results[0]["embedding"]

        return {
            "message": "AI đã nhìn thấy khuôn mặt thành công!",
            "faces_detected": len(results),
            "vector_length": len(embedding_vector),
            "vector_sample": embedding_vector[:5]
        }
    
    except ValueError:
        return {"error": "Không tìm thấy khuôn mặt nào trong ảnh. Vui lòng chọn ảnh rõ mặt hơn!"}
    except Exception as e:
        return {"error": f"Lỗi hệ thống: {str(e)}"}

# --- NGÀY 3: API So sánh 2 khuôn mặt ---
@app.post("/api/verify")
async def verify_faces(file1: UploadFile = File(...), file2: UploadFile = File(...)):
    try:
        # 1. Đọc bức ảnh thứ nhất từ RAM
        contents1 = await file1.read()
        nparr1 = np.frombuffer(contents1, np.uint8)
        img1 = cv2.imdecode(nparr1, cv2.IMREAD_COLOR)

        # 2. Đọc bức ảnh thứ hai từ RAM
        contents2 = await file2.read()
        nparr2 = np.frombuffer(contents2, np.uint8)
        img2 = cv2.imdecode(nparr2, cv2.IMREAD_COLOR)

        # 3. Yêu cầu DeepFace so sánh 2 khuôn mặt
        # Dùng model Facenet và metric 'cosine' (đo góc giữa 2 vector)
        result = DeepFace.verify(
            img1_path=img1, 
            img2_path=img2, 
            model_name="Facenet", 
            detector_backend="mtcnn",
            enforce_detection=True
        )

        # 4. Trả về kết quả
        return {
            "message": "So sánh thành công!",
            "is_same_person": bool(result["verified"]), # True là cùng 1 người, False là khác người
            "distance": float(result["distance"]),       # Khoảng cách giữa 2 khuôn mặt
            "threshold": float(result["threshold"])      # Ngưỡng quyết định
        }
    
    except ValueError:
        return {"error": "Không tìm thấy khuôn mặt trong 1 hoặc cả 2 bức ảnh. Vui lòng thử ảnh rõ mặt hơn!"}
    except Exception as e:
        return {"error": f"Lỗi hệ thống: {str(e)}"}