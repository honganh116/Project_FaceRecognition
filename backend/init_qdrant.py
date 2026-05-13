from qdrant_client import QdrantClient
from qdrant_client.models import VectorParams, Distance

# Kết nối tới Qdrant đang chạy trong Docker
client = QdrantClient(host="localhost", port=6333)

# Giả sử model nhận diện khuôn mặt của bạn xuất ra vector 512 chiều
VECTOR_SIZE = 512 
COLLECTION_NAME = "face_embeddings"

# Tạo collection sử dụng khoảng cách Cosine (phổ biến nhất cho Face Recognition)
client.recreate_collection(
    collection_name=COLLECTION_NAME,
    vectors_config=VectorParams(size=VECTOR_SIZE, distance=Distance.COSINE),
)
print(f"Đã tạo thành công collection: {COLLECTION_NAME}")