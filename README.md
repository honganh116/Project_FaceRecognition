# 👁️ Hệ Thống Nhận Diện Khuôn Mặt Thời Gian Thực (Enterprise Architecture)

Đồ án môn học: **Kỹ nghệ hệ thống TTNT**  
Quy mô dự án: Xây dựng hệ thống nhận diện khuôn mặt thời gian thực theo kiến trúc Microservices, phục vụ chấm công và quản lý nhân sự.

## 👥 Đội ngũ phát triển
| STT | Họ và Tên | Vai trò chính | Nhiệm vụ cụ thể |
| :--- | :--- | :--- | :--- |
| 1 | **Nguyễn Hồng Anh** <br>*(MSV: 24022255)* | AI & Core Backend | Viết API bằng FastAPI. Tích hợp DeepFace (OpenCV) để trích xuất vector khuôn mặt và xử lý logic so sánh. |
| 2 | **Nguyễn Đức Bình** <br>*(MSV: 24022269)* | Database & Message Queue | Thiết kế PostgreSQL (lưu User). Setup MinIO (lưu ảnh gốc) và Qdrant/Milvus (Vector DB). Làm Message Queue (Redis/RabbitMQ). |
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

## ⚙️ Hướng dẫn Triển khai (Local Environment)

**Yêu cầu môi trường:** Máy tính đã cài đặt **Docker** và **Docker Compose**.

### 1. Clone dự án
```bash
1. Chuẩn bị môi trường
Hệ thống đã được đóng gói sẵn hoàn toàn trên Docker Hub. Bạn không cần tải mã nguồn.
1. Tạo một thư mục trống (ví dụ: `BTL_FaceRecognition`).
2. Tải và đặt 2 file `docker-compose.yml` , `.env` và nginx vào chung trong thư mục này.
```

### 2. Khởi động toàn bộ Hệ thống
Khởi động toàn bộ Hệ thống
Hệ thống sử dụng kiến trúc Microservices. Bạn chỉ cần mở Terminal (hoặc Command Prompt/VS Code) tại thư mục chứa 2 file trên và chạy lệnh duy nhất sau:
```bash
docker-compose up -d
```
*(Đợi khoảng 1-3 phút để Docker tải image và khởi động các container).*

### 3. Truy cập các Dịch vụ
Sau khi hệ thống báo `Started`, các cổng nội bộ đã được đóng kín để bảo mật. Toàn bộ giao diện được điều phối qua cổng `80`:

* 📷 **Giao diện Terminal Quét mặt (Kiosk):** [http://localhost/](http://localhost/)
* 🛡️ **Giao diện Quản trị viên (Admin):** [http://localhost/admin/](http://localhost/admin/)
  * *Tài khoản mặc định:* `admin`
  * *Mật khẩu mặc định:* `123`
* 🗄️ **Kho lưu trữ Ảnh thô (MinIO Console):** [http://localhost:9001](http://localhost:9001)
  * *Tài khoản:* `admin` | *Mật khẩu:* `password123`
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
