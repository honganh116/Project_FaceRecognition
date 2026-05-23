import redis
from rq import Worker, Queue

# Kết nối tới Redis trong Docker (dùng hostname là 'redis')
redis_conn = redis.Redis(host='redis', port=6379)

if __name__ == '__main__':
    print("[WORKER] Đang khởi động và lắng nghe hàng đợi 'default'...")
    
    # Ở chuẩn RQ mới (2.0+), ta truyền trực tiếp connection vào Queue và Worker
    queue = Queue('default', connection=redis_conn)
    worker = Worker([queue], connection=redis_conn)
    
    # Bắt đầu làm việc
    worker.work()