import redis
from rq import Worker, Queue, Connection

# Kết nối tới Redis trong Docker (dùng hostname là 'redis')
redis_conn = redis.Redis(host='redis', port=6379)

if __name__ == '__main__':
    print("[WORKER] Đang khởi động và lắng nghe hàng đợi 'default'...")
    with Connection(redis_conn):
        worker = Worker(Queue('default'))
        worker.work()