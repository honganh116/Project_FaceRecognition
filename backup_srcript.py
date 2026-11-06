import os
import subprocess
from datetime import datetime
import urllib.request
import json

BACKUP_DIR = "./backups"
TIMESTAMP = datetime.now().strftime("%Y%m%d_%H%M%S")
os.makedirs(BACKUP_DIR, exist_ok=True)

PG_USER = os.getenv("POSTGRES_USER", "admin")
PG_DB = os.getenv("POSTGRES_DB", "ai_project")


def backup_postgres():
    print("--- [1/2] Đang sao lưu PostgreSQL ---")
    filename = os.path.join(BACKUP_DIR, f"postgres_backup_{TIMESTAMP}.sql")
    try:
        with open(filename, "wb") as out_file:
            subprocess.run(
                ["docker", "exec", "postgres", "pg_dump", "-U", PG_USER, PG_DB],
                stdout=out_file,
                check=True,
            )
        print(f"✅ Đã lưu bản sao lưu SQL tại: {filename}")
    except Exception as err:
        print(f"❌ Lỗi khi sao lưu PostgreSQL: {err}")


def backup_qdrant():
    print("--- [2/2] Đang sao lưu Qdrant (Vector DB) ---")
    url = "http://localhost:6333/collections/face_embeddings/snapshots"
    try:
        req = urllib.request.Request(url, method="POST")
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            snapshot_name = data.get("result", {}).get("name", "unknown")
            print(f"✅ Qdrant đã tạo snapshot thành công: {snapshot_name}")
    except Exception as err:
        print(f"❌ Lỗi tạo snapshot Qdrant: {err}")


if __name__ == "__main__":
    backup_postgres()
    backup_qdrant()
    print("=== Hoàn thành toàn bộ tiến trình Backup! ===")
