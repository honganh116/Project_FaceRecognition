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

## 🚀 Kiến trúc Hệ thống (Distributed Architecture)
Hệ thống được module hóa thành **9 Container độc lập** để đảm bảo khả năng chịu tải:
1. **Core AI Engine:** Tích hợp mô hình ArcFace 512D.
2. **Asynchronous Worker:** Sử dụng Redis & RQ Worker xử lý AI ngầm.
3. **Polyglot Storage:** Qdrant (Vector DB), Postgres (Metadata), MinIO (Object Storage).
4. **Edge Computing:** Kiosk Client tự phân tích Bounding Box để giảm tải Server.

---

## 🛠️ Công nghệ & Ngôn ngữ
* **Ngôn ngữ:** Python, JavaScript.
* **AI/Computer Vision:** OpenCV, DeepFace (ArcFace, SSD).
* **Backend Framework:** FastAPI.
* **Frontend Framework:** ReactJS, TailwindCSS.
* **Cơ sở dữ liệu:** PostgreSQL, Qdrant, MinIO.
* **Message Broker:** Redis, Python-RQ.
* **DevOps & Triển khai:** Docker, Docker Compose, Nginx.

---

## ⚙️ Hướng dẫn Triển khai (Local Environment)

Yêu cầu: Máy tính đã cài đặt **Docker** và **Docker Compose**.

## ⚙️ Hướng dẫn Triển khai (Local Environment)

**Yêu cầu môi trường:** Máy tính đã cài đặt **Docker** và **Docker Compose**.
Hệ thống đã được đóng gói và đẩy image lên **Docker Hub**. Giảng viên không cần tải toàn bộ mã nguồn.


### 1. Chuẩn bị môi trường
1. Tạo một thư mục trống.
2. Tải và đặt 3 file sau vào chung thư mục: `docker-compose.yml`, `.env`, và thư mục `nginx` (chứa file `nginx.conf`).

### 2. Khởi động toàn bộ Hệ thống
Mở Terminal tại thư mục đó và chạy lệnh:
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