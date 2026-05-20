FROM python:3.10-slim

WORKDIR /app

# Dạy Docker cài thêm các thư viện lõi của Linux (Viết trên 1 dòng để chống lỗi cú pháp)
RUN apt-get update && apt-get install -y libglib2.0-0 libgl1 && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]