from fastapi import FastAPI, File, UploadFile, Form
from database import init_db, register_user
from deepface import DeepFace
import cv2
import numpy as np

# Khởi tạo app
app = FastAPI(title="Hệ thống Nhận diện Khuôn mặt", version="1.0")

# Khởi tạo Cơ sở dữ liệu ngay khi bật Server (THÊM MỚI)
init_db() 

@app.get("/")
def read_root():
    return {"message": "Server FastAPI đang hoạt động trơn tru!"}

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "Face Recognition Core"}

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

@app.post("/api/verify")
async def verify_faces(file1: UploadFile = File(...), file2: UploadFile = File(...)):
    try:
        contents1 = await file1.read()
        nparr1 = np.frombuffer(contents1, np.uint8)
        img1 = cv2.imdecode(nparr1, cv2.IMREAD_COLOR)

        contents2 = await file2.read()
        nparr2 = np.frombuffer(contents2, np.uint8)
        img2 = cv2.imdecode(nparr2, cv2.IMREAD_COLOR)

        result = DeepFace.verify(
            img1_path=img1, 
            img2_path=img2, 
            model_name="Facenet", 
            detector_backend="mtcnn",
            enforce_detection=True
        )

        return {
            "message": "So sánh thành công!",
            "is_same_person": bool(result["verified"]), 
            "distance": float(result["distance"]),       
            "threshold": float(result["threshold"])      
        }
    
    except ValueError:
        return {"error": "Không tìm thấy khuôn mặt trong 1 hoặc cả 2 bức ảnh. Vui lòng thử ảnh rõ mặt hơn!"}
    except Exception as e:
        return {"error": f"Lỗi hệ thống: {str(e)}"}

@app.post("/api/register")
async def register_face(
    name: str = Form(...),            # Nhận Tên người dùng
    student_code: str = Form(...),    # Nhận Mã Sinh Viên
    file: UploadFile = File(...)      # Nhận Ảnh
):
    try:
        # 1. Đọc ảnh
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        # 2. Trích xuất vector bằng MTCNN (Mắt thần xịn)
        results = DeepFace.represent(
            img_path=img, 
            model_name="Facenet", 
            detector_backend="mtcnn", 
            enforce_detection=True
        )
        embedding_vector = results[0]["embedding"]

        # 3. Gọi hàm lưu vào file face_database.db
        success, msg = register_user(name, student_code, embedding_vector)

        if success:
            return {"message": msg, "name": name, "student_code": student_code}
        else:
            return {"error": msg}

    except ValueError:
        return {"error": "Không tìm thấy khuôn mặt trong ảnh. Vui lòng thử ảnh rõ mặt hơn!"}
    except Exception as e:
        return {"error": f"Lỗi hệ thống: {str(e)}"}