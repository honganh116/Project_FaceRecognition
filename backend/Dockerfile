# 1. Sử dụng image Python 3.10 siêu nhẹ chuẩn AI
FROM python:3.10-slim

# 2. Đặt thư mục làm việc trong máy ảo
WORKDIR /app

# 3. Copy file danh sách thư viện và cài đặt
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 4. Copy toàn bộ code của bạn vào máy ảo
COPY . .

# 5. Lệnh khởi động server
CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]