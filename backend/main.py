from fastapi import FastAPI, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from database import init_db, register_user, find_match_in_db, log_attendance, get_all_logs
from deepface import DeepFace
import cv2
import numpy as np

# Khởi tạo app
app = FastAPI(title="Hệ thống Nhận diện Khuôn mặt", version="1.0")

# Khởi tạo Cơ sở dữ liệu ngay khi bật Server (THÊM MỚI)
init_db() 

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Cho phép mọi trang web gọi vào
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mở file backend/main.py, tìm đến đoạn init_db() và thêm phần này vào ngay dưới:

@app.on_event("startup")
def warmup_ai_models():
    print("⏳ Đang làm nóng (Warm-up) model AI... Vui lòng đợi.")
    try:
        # Tạo một bức ảnh đen giả (kích thước 224x224)
        dummy_img = np.zeros((224, 224, 3), dtype=np.uint8)
        
        # Bắt DeepFace chạy thử 1 lần. 
        # Cài enforce_detection=False để nó không ném lỗi khi không thấy mặt trong ảnh đen
        DeepFace.represent(
            img_path=dummy_img, 
            model_name="Facenet", 
            detector_backend="mtcnn", 
            enforce_detection=False
        )
        print("✅ Nạp AI thành công! Server đã sẵn sàng nhận diện siêu tốc.")
    except Exception as e:
        print(f"⚠️ Lỗi lúc khởi động AI: {e}")

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

@app.post("/api/recognize")
async def recognize_face(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        # 1. TĂNG TỐC: Đổi detector_backend từ "mtcnn" sang "opencv"
        # OpenCV dò mặt siêu nhanh, phù hợp cho luồng stream liên tục
        results = DeepFace.represent(
            img_path=img, 
            model_name="Facenet", 
            detector_backend="opencv", 
            enforce_detection=True
        )

        # 2. XỬ LÝ NHIỀU KHUÔN MẶT: Báo lỗi nếu có > 1 người
        if len(results) > 1:
            return {
                "status": "warning", 
                "message": "Cảnh báo: Phát hiện nhiều khuôn mặt. Vui lòng quét từng người!"
            }

        target_embedding = results[0]["embedding"]
        
        # Lấy tọa độ khuôn mặt từ kết quả của DeepFace
        facial_area = results[0].get("facial_area", {})
        box = {
            "x": facial_area.get("x", 0),
            "y": facial_area.get("y", 0),
            "w": facial_area.get("w", 0),
            "h": facial_area.get("h", 0)
        }

        # Đem vector đi so sánh với DB
        found, match_info, distance = find_match_in_db(target_embedding)

        if found:
            log_attendance(match_info["name"], match_info["student_code"])
            return {
                "message": "Xin chào người quen!",
                "user": match_info, 
                "distance": round(distance, 4),
                "box": box  # Ném thêm tọa độ về cho Frontend
            }
        else:
            return {
                "message": "Cảnh báo: Phát hiện người lạ!",
                "distance": round(distance, 4) if distance != float('inf') else None,
                "box": box  # Người lạ cũng phải vẽ khung để theo dõi
            }

    except ValueError:
        return {"status": "error", "message": "Không tìm thấy khuôn mặt trong ảnh!"}
    except Exception as e:
        return {"status": "error", "message": f"Lỗi hệ thống: {str(e)}"}
    
@app.get("/api/logs")
def view_attendance_logs():
    logs = get_all_logs()
    return {
        "message": "Danh sách điểm danh",
        "total_records": len(logs),
        "data": logs
    }