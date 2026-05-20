from fastapi import FastAPI, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from database import init_db, register_user, find_match_in_db, log_attendance, get_all_logs, get_shift_time, update_shift_time, delete_user_by_code, get_all_users
from deepface import DeepFace
from pydantic import BaseModel
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from passlib.context import CryptContext
from datetime import datetime, timedelta
import cv2
import numpy as np

# 1. Cấu hình bảo mật
SECRET_KEY = "Sieu_Mat_Khau_Cua_Ban_O_Day"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "123" 

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/login")

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_admin(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username != ADMIN_USERNAME:
            raise HTTPException(status_code=401, detail="Không có quyền truy cập")
        return username
    except JWTError:
        raise HTTPException(status_code=401, detail="Phiên làm việc hết hạn")

# 🌟 2. KHỞI TẠO APP
app = FastAPI(title="Hệ thống Nhận diện Khuôn mặt", version="1.0")

# Khởi tạo Database Enterprise
init_db() 

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 🌟 3. API ĐĂNG NHẬP
@app.post("/api/login")
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    if form_data.username == ADMIN_USERNAME and form_data.password == ADMIN_PASSWORD:
        access_token = create_access_token(data={"sub": form_data.username})
        return {"access_token": access_token, "token_type": "bearer"}
    raise HTTPException(status_code=400, detail="Sai tài khoản hoặc mật khẩu")


@app.on_event("startup")
def warmup_ai_models():
    print("⏳ Đang làm nóng (Warm-up) model AI... Vui lòng đợi.")
    try:
        dummy_img = np.zeros((224, 224, 3), dtype=np.uint8)
        DeepFace.represent(
            img_path=dummy_img, 
            model_name="ArcFace",        
            detector_backend="ssd",      
            enforce_detection=False,
            align=False
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

        results = DeepFace.represent(
            img_path=img, 
            model_name="ArcFace",        
            detector_backend="ssd",      
            enforce_detection=True,
            align=True
        )
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
            model_name="ArcFace",        
            detector_backend="ssd",      
            enforce_detection=True,
            align=True
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
    name: str = Form(...),            
    student_code: str = Form(...),    
    file: UploadFile = File(...),      
    admin: str = Depends(get_current_admin)
):
    try:
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        results = DeepFace.represent(
            img_path=img, 
            model_name="ArcFace",        
            detector_backend="ssd",      
            enforce_detection=True,
            align=True                   
        )
        embedding_vector = results[0]["embedding"]

        # 🌟 Cập nhật: Truyền thêm ảnh (contents) vào hàm
        success, msg = register_user(name, student_code, embedding_vector, contents)

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

        results = DeepFace.represent(
            img_path=img, 
            model_name="ArcFace",        
            detector_backend="ssd",      
            enforce_detection=True,
            align=True                   
        )

        if len(results) > 1:
            return {
                "status": "warning", 
                "message": "Cảnh báo: Phát hiện nhiều khuôn mặt. Vui lòng quét từng người!"
            }

        target_embedding = results[0]["embedding"]
        
        facial_area = results[0].get("facial_area", {})
        box = {
            "x": facial_area.get("x", 0),
            "y": facial_area.get("y", 0),
            "w": facial_area.get("w", 0),
            "h": facial_area.get("h", 0)
        }

        found, match_info, distance = find_match_in_db(target_embedding)

        if found:
            log_attendance(match_info["name"], match_info["student_code"])
            return {
                "message": "Xin chào người quen!",
                "user": match_info, 
                "distance": round(distance, 4),
                "box": box  
            }
        else:
            return {
                "message": "Cảnh báo: Phát hiện người lạ!",
                "distance": round(distance, 4) if distance != float('inf') else None,
                "box": box  
            }

    except ValueError:
        return {"status": "error", "message": "Không tìm thấy khuôn mặt trong ảnh!"}
    except Exception as e:
        return {"status": "error", "message": f"Lỗi hệ thống: {str(e)}"}
    
@app.get("/api/logs")
def view_attendance_logs(admin: str = Depends(get_current_admin)):
    logs = get_all_logs()
    return {
        "message": "Danh sách điểm danh",
        "total_records": len(logs),
        "data": logs
    }


@app.get("/api/users")
def view_all_users(admin: str = Depends(get_current_admin)):
    users = get_all_users()
    return {
        "message": "Danh sách nhân sự",
        "total_records": len(users),
        "data": users
    }

# --- API LƯU CẤU HÌNH GIỜ VÀO CA ---
class ShiftTimeUpdate(BaseModel):
    shift_time: str

@app.get("/api/settings/shift-time")
def get_shift_time_api():
    return {"shift_time": get_shift_time()}

@app.post("/api/settings/shift-time")
def update_shift_time_api(data: ShiftTimeUpdate, admin: str = Depends(get_current_admin)):
    update_shift_time(data.shift_time)
    return {"message": "Cập nhật giờ vào ca thành công!"}

@app.delete("/api/users/{student_code}")
def remove_user(student_code: str, admin: str = Depends(get_current_admin)):
    success, msg = delete_user_by_code(student_code)
    if success:
        return {"message": msg}
    else:
        raise HTTPException(status_code=404, detail=msg)