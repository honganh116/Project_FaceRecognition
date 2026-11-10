# 👁️ Hệ Thống Nhận Diện Khuôn Mặt Thời Gian Thực (Enterprise Architecture v3.1)

Đồ án môn học: **Thực hành Phát triển Hệ thống Trí tuệ Nhân tạo / Kỹ nghệ Hệ thống TTNT**  
Quy mô dự án: Xây dựng hệ thống nhận diện khuôn mặt thời gian thực theo kiến trúc Microservices, phục vụ chấm công không chạm, giám sát an ninh camera IP RTSP và phát hiện tuân thủ trang bị bảo hộ (Khẩu trang / PPE).

## 👥 Đội ngũ phát triển
| STT | Họ và Tên | Vai trò chính | Nhiệm vụ cụ thể |
| :--- | :--- | :--- | :--- |
| 1 | **Nguyễn Hồng Anh** <br> | AI & Core Backend | Viết API bằng FastAPI. Tích hợp DeepFace (ArcFace 512D), tiền xử lý ảnh CLAHE, phát hiện Khẩu trang / PPE, chống giả mạo (Anti-Spoofing), nhận diện Periocular đa khuôn mặt và chuẩn hóa vector L2. |
| 2 | **Nguyễn Đức Bình** <br> | Database & Message Queue | Thiết kế PostgreSQL (Metadata + Mask Status + RTSP Config). Setup MinIO (Object Storage) và Qdrant (Vector DB). Tích hợp Redis Queue xử lý Multi-Embedding. |
| 3 | **Phạm Gia Bảo** <br> | Frontend & Edge Computing | Xây dựng luồng Admin & Kiosk (ReactJS). Xử lý Auto-Scan, Multi-Face Tracking HUD, chuyển đổi nguồn Video (Webcam / Live RTSP Stream) và bảng điều khiển giám sát an ninh. |
| 4 | **Đào Gia Thế Vũ** <br> | DevOps, Tích hợp & Tài liệu | Viết `docker-compose.yml`, cấu hình Nginx Reverse Proxy. Ghép nối luồng RTSP MJPEG `/api/rtsp/stream`. Viết Báo cáo & Slide. |

---

## 🚀 Kiến trúc Hệ thống & Nâng cấp AI v3.1 (Distributed Architecture)
Hệ thống được module hóa thành **9 Container độc lập** kết hợp pipeline Thị giác máy tính nâng cao:
1. **Core AI Engine (ArcFace 512D + L2 Norm):** Trích xuất vector đặc trưng khuôn mặt 512 chiều chuẩn hóa đơn vị ($\|v\|_2 = 1$) kết hợp cơ chế **Multi-Embedding Consensus** trên Qdrant.
2. **Smart Image Enhancement Pipeline:** Tự động cân bằng sáng cục bộ **CLAHE** trên không gian màu LAB, hiệu chỉnh **Adaptive Gamma** khi ngược sáng/thiếu sáng, và kiểm tra độ mờ **Laplacian Blur**.
3. **Hybrid Face Anti-Spoofing (Liveness Detection):** Phát hiện giả mạo qua màn hình điện thoại hoặc ảnh in giấy dựa trên phân tích phổ tần số **2D FFT (Moiré Pattern)**, sắc độ da **YCrCb/HSV**, phản xạ lóa (**Glare**) và vi cấu trúc bề mặt (**Sobel Micro-Texture**).
4. **Phát hiện Khẩu trang & Tuân thủ PPE (Hướng 3 Nâng cấp):**
   - Phân đoạn màu da và vật liệu bảo hộ trên không gian YCrCb & HSV.
   - Nhận diện khẩu trang y tế (xanh, trắng), khẩu trang vải/đen và cảnh báo đeo sai quy cách (hở mũi).
   - Tăng cường vùng mắt (**Periocular / Upper-Face CLAHE Enhancement**) và tự động nới lỏng ngưỡng cosine ArcFace (0.40) giúp nhận diện chính xác người đeo khẩu trang mà không cần tháo bỏ.
   - Lưu trữ trạng thái tuân thủ `mask_status` trong PostgreSQL và xuất báo cáo điểm danh Excel/CSV chi tiết.
5. **Camera An Ninh RTSP & Multi-Face Walk-Through (Hướng 5 Nâng cấp):**
   - Kết nối luồng RTSP từ Camera IP an ninh (Dahua, Hikvision, Ezviz, Uniview) hoặc webcam máy trạm.
   - Trích xuất đồng thời **toàn bộ khuôn mặt trong một khung hình** (Multi-Face Detection via SSD DeepFace) cho phép điểm danh liên tục khi di chuyển theo nhóm (Walk-Through).
   - Endpoint phát luồng trực tiếp MJPEG `/api/rtsp/stream` vẽ kèm HUD Bounding Box đa sắc (Xanh dương: Nhận diện có khẩu trang, Xanh lá: Nhận diện chuẩn, Cam: Giả mạo/Cảnh báo, Đỏ: Chưa đăng ký).
   - Cung cấp giao diện Giám sát Camera An ninh chuyên dụng trên Admin Dashboard và Kiosk view.
6. **Asynchronous AI Worker (Redis + RQ):** Xử lý ngầm tác vụ **Data Augmentation** (sinh biến thể lật gương, nghiêng đầu `±5°`, cân bằng sáng) và lập chỉ mục đa vector vào Qdrant sau khi đăng ký.
7. **Edge Auto-Scan (Kiosk PWA):** Tự động nhận diện không chạm khi phát hiện người đứng ổn định trong khung ngắm, đọc lời chào bằng giọng nói tiếng Việt tự nhiên (Web Speech API).

---

## 🛠️ Công nghệ & Ngôn ngữ
* **Ngôn ngữ:** Python 3.10, JavaScript (ES6+).
* **AI & Xử lý ảnh:** OpenCV (CLAHE, FFT, Sobel, Laplacian, YCrCb/HSV Mask Detection), DeepFace (ArcFace, SSD Multi-Face), NumPy.
* **Backend Framework:** FastAPI, SQLAlchemy, JWT Authentication, Starlette StreamingResponse (MJPEG).
* **Frontend Framework:** ReactJS 18, Vite, TailwindCSS, Framer Motion, Lucide Icons.
* **Cơ sở dữ liệu (Polyglot Storage):** PostgreSQL 16, Qdrant Vector DB, MinIO Object Storage.
* **Message Broker:** Redis 7, Python-RQ.
* **DevOps & Triển khai:** Docker, Docker Compose, Nginx Reverse Proxy.

---

## ⚙️ Hướng dẫn Triển khai (Local Environment)

**Yêu cầu môi trường:** Máy tính đã cài đặt **Docker**, **Docker Compose** và **Git**.

### 1. Chuẩn bị môi trường
1. Clone dự án về máy tính và di chuyển vào thư mục gốc:
```bash
git clone https://github.com/honganh116/Project_FaceRecognition.git
cd Project_FaceRecognition
```
2. Sao chép file `.env.example` thành `.env`:
```bash
cp .env.example .env
```

### 2. Khởi động toàn bộ Hệ thống
Mở Terminal tại thư mục gốc của dự án và chạy lệnh:
```bash
docker-compose up -d --build
```
*(Nếu chỉ muốn chạy nhanh từ image có sẵn trên Docker Hub cùng mã nguồn Backend mới nhất, bạn có thể dùng `docker-compose up -d`).*

### 3. Truy cập các Dịch vụ
Toàn bộ giao diện người dùng và API được điều phối qua cổng `80` của Nginx Reverse Proxy:

* 📷 **Giao diện Terminal Quét mặt Kiosk:** [http://localhost/](http://localhost/)
  * Hỗ trợ chuyển đổi linh hoạt giữa Webcam máy trạm và luồng Camera RTSP an ninh.
* 🛡️ **Giao diện Quản trị viên (Admin):** [http://localhost/admin/](http://localhost/admin/)
  * *Tài khoản mặc định:* `admin`
  * *Mật khẩu mặc định:* `admin123`
  * Quản lý điểm danh kèm trạng thái Khẩu trang / PPE, xuất báo cáo CSV, Giám sát luồng Camera RTSP CCTV và Phòng Lab AI.
* 🗄️ **Kho lưu trữ Ảnh gốc (MinIO Console):** [http://localhost:9001](http://localhost:9001)
  * *Tài khoản:* Theo `MINIO_ACCESS_KEY` và `MINIO_SECRET_KEY` trong file `.env`
* 🧠 **Kho lưu trữ AI Vector (Qdrant Dashboard):** [http://localhost:6333/dashboard](http://localhost:6333/dashboard)

### 4. Dừng hệ thống
Để tắt hệ thống an toàn (dữ liệu nhân sự vẫn được giữ nguyên cho lần bật sau):
```bash
docker-compose down
```

🚨 **Lưu ý (Nguy hiểm):** Nếu bạn muốn "reset" toàn bộ hệ thống, xóa sạch mọi dữ liệu Database, MinIO ảnh và Qdrant để làm lại từ đầu, hãy thêm cờ `-v`:
```bash
docker-compose down -v
```
