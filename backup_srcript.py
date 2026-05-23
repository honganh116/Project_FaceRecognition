import os
import subprocess
from datetime import datetime

# Cấu hình
BACKUP_DIR = "./backups"
TIMESTAMP = datetime.now().strftime("%Y%m%d_%H%M%S")
os.makedirs(BACKUP_DIR, exist_ok=True)

def backup_postgres():
    print("--- Đang sao lưu PostgreSQL ---")
    filename = f"{BACKUP_DIR}/postgres_backup_{TIMESTAMP}.sql"
    # Gọi lệnh pg_dump trực tiếp từ bên trong container postgres
    cmd = f"docker exec project_postgres pg_dump -U admin ai_system_db > {filename}"
    subprocess.run(cmd, shell=True, check=True)
    print(f"Đã lưu file SQL tại: {filename}")

def backup_qdrant():
    print("--- Đang sao lưu Qdrant (Vector DB) ---")
    filename = f"{BACKUP_DIR}/qdrant_backup_{TIMESTAMP}.snapshot"
    # Gọi API của Qdrant để nó tự chụp một bản sao lưu (snapshot)
    import requests
    url = f"http://localhost:6333/collections/face_embeddings/snapshots"
    response = requests.post(url)
    if response.status_code == 200:
        snapshot_name = response.json()['result']['name']
        print(f"Qdrant đã tạo snapshot ngầm: {snapshot_name}")
    else:
        print("Lỗi tạo snapshot Qdrant")

if __name__ == "__main__":
    backup_postgres()
    backup_qdrant()
    print("=== Hoàn thành toàn bộ tiến trình Backup! ===")