import logging
import os
import time
import redis
from rq import Worker, Queue

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
)
logger = logging.getLogger("faceid.worker")

REDIS_HOST = os.getenv("REDIS_HOST", "redis")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))


def start_worker() -> None:
    """Khởi chạy RQ Worker với cơ chế tự động kết nối lại nếu Redis đang khởi động."""
    for attempt in range(1, 6):
        try:
            redis_conn = redis.Redis(host=REDIS_HOST, port=REDIS_PORT)
            redis_conn.ping()
            logger.info(
                f"🚀 AI Worker đã kết nối tới Redis ({REDIS_HOST}:{REDIS_PORT}) và đang lắng nghe hàng đợi 'default'..."
            )
            queue = Queue("default", connection=redis_conn)
            worker = Worker([queue], connection=redis_conn)
            worker.work()
            break
        except Exception as err:
            logger.warning(f"⏳ Chờ Redis sẵn sàng (Lần {attempt}/5): {err}")
            time.sleep(2)


if __name__ == "__main__":
    start_worker()
