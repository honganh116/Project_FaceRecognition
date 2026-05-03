# 👁️ Hệ Thống Nhận Diện Khuôn Mặt Thời Gian Thực (Enterprise Architecture)

Đồ án môn học: **Kỹ nghệ hệ thống TTNT**  
Quy mô dự án: Xây dựng hệ thống nhận diện khuôn mặt thời gian thực theo kiến trúc Microservices, phục vụ chấm công và quản lý nhân sự.

## 👥 Đội ngũ phát triển
| STT | Họ và Tên | Vai trò chính | Nhiệm vụ cụ thể |
| :--- | :--- | :--- | :--- |
| 1 | **Nguyễn Hồng Anh** <br>*(MSV: 24022255)* | AI & Core Backend | Viết API bằng FastAPI. Tích hợp DeepFace (OpenCV) để trích xuất vector khuôn mặt và xử lý logic so sánh. |
| 2 | **Nguyễn Đức Bình** | Database & Message Queue | Thiết kế PostgreSQL (lưu User). Setup MinIO (lưu ảnh gốc) và Qdrant/Milvus (Vector DB). Làm Message Queue (Redis/RabbitMQ). |
| 3 | **Phạm Gia Bảo** <br>*(MSV: 24022267)* | Frontend (Giao diện) | Xây dựng luồng Admin & User (ReactJS/VueJS). Xử lý luồng Stream Video WebSockets/WebRTC, vẽ Bounding Box. |
| 4 | **Đào Gia Thế Vũ** <br>*(MSV: 24022491)* | DevOps, Tích hợp & Tài liệu | Viết `docker-compose.yml`, cấu hình Nginx (Load balancer). Ghép nối API Backend với Frontend. Viết Báo cáo & Slide. |

---

## 🚀 Kiến trúc Hệ thống (Microservices)

Dự án được chia thành các module độc lập để đảm bảo hiệu suất xử lý luồng video thời gian thực:
1. **Core AI Engine:** Nhận khung hình (frame), dùng FaceNet/MTCNN để trích xuất mảng 128 chiều (128-d vector).
2. **Vector Search Engine:** Tìm kiếm vector tương đồng tốc độ cao bằng cơ sở dữ liệu chuyên dụng (Qdrant/Milvus).
3. **Storage & Metadata:** Lưu trữ ảnh thô trên MinIO (Object Storage) và thông tin định danh nhân sự trên PostgreSQL.
4. **Real-time Streaming:** Giao tiếp luồng video liên tục từ Client (Camera) lên Server thông qua WebRTC/WebSockets.

---

## 🛠️ Công nghệ & Ngôn ngữ
* **Ngôn ngữ:** Python, JavaScript.
* **AI/Computer Vision:** OpenCV, DeepFace (Facenet, MTCNN).
* **Backend Framework:** FastAPI.
* **Frontend Framework:** ReactJS / VueJS, HTML5/CSS3.
* **Cơ sở dữ liệu:** PostgreSQL (Relational), Qdrant / Milvus (Vector Search), MinIO (S3 Object Storage).
* **Message Broker:** Redis / RabbitMQ.
* **DevOps & Triển khai:** Docker, Docker Compose, Nginx.

---

## ⚙️ Hướng dẫn Triển khai (Local Environment)

Yêu cầu: Máy tính đã cài đặt **Docker** và **Docker Compose**.

### 1. Clone dự án
```bash
git clone https://github.com/honganh116/Project_FaceRecognition.git
cd Project_FaceRecognition

2. Khởi động Máy chủ Backend (AI Engine)

Yêu cầu: Máy tính đã cài đặt **Docker**.
Mở Terminal tại thư mục `backend` và chạy lệnh sau:

docker-compose up -d --build
docker run -p 8000:8000 -v ${PWD}:/app face-backend

3. Truy cập các dịch vụ

Ứng dụng Web: http://localhost:3000

Tài liệu API (Swagger): http://localhost:8000/docs

Quản trị Database (pgAdmin): http://localhost:5050

MinIO Console: http://localhost:9001

4. Dừng hệ thống

docker-compose down -v

