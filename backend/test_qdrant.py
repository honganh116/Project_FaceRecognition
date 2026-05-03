from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct
import numpy as np

# 1. Kết nối tới Qdrant đang chạy trên Docker (Cổng 6333)
client = QdrantClient("localhost", port=6333)
collection_name = "faces_db"

print("Đang kết nối tới Qdrant...")

# 2. Tạo một Collection (Giống như tạo Table trong SQL)
# CÁCH MỚI CHUẨN XÁC: Kiểm tra xem nó có tồn tại chưa, chưa có thì mới tạo
if not client.collection_exists(collection_name):
    client.create_collection(
        collection_name=collection_name,
        vectors_config=VectorParams(size=128, distance=Distance.COSINE),
    )
    print(f"✅ Đã tạo MỚI thành công bộ nhớ Vector: '{collection_name}'")
else:
    print(f"⚡ Bộ nhớ Vector '{collection_name}' đã có sẵn, sẵn sàng sử dụng!")

# 3. Tạo một Vector "Giả" (128 con số ngẫu nhiên) đại diện cho mặt của Hồng Anh
dummy_vector = np.random.rand(128).tolist()

# 4. Lưu khuôn mặt này vào Database
client.upsert(
    collection_name=collection_name,
    points=[
        PointStruct(
            id=1, # Mã định danh duy nhất (có thể dùng ID của user)
            vector=dummy_vector, 
            payload={"name": "Nguyễn Hồng Anh", "student_code": "24022255"} # Data đi kèm
        )
    ]
)
print("✅ Đã lưu dữ liệu khuôn mặt của Hồng Anh vào Qdrant thành công!")

# 5. TEST TÌM KIẾM: Thử tìm xem có ai giống cái vector này không
print("\n🔍 Đang tìm kiếm khuôn mặt giống nhất...")
search_result = client.query_points(
    collection_name=collection_name,
    query=dummy_vector, 
    limit=1 # Chỉ lấy 1 người giống nhất
)

# Chú ý: Ở phiên bản mới, danh sách kết quả nằm trong biến .points
for hit in search_result.points:
    print(f"🎉 TÌM THẤY! Người này là: {hit.payload['name']} - Độ chính xác: {round(hit.score * 100, 2)}%")