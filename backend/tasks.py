import logging
import cv2
import numpy as np
from deepface import DeepFace
from database import get_image_from_minio, upsert_augmented_embedding
from vision_pipeline import enhance_face_image, generate_augmented_variants

logger = logging.getLogger("faceid.tasks")


def process_face_recognition(image_name: str, student_code: str, name: str = "") -> bool:
    """
    Worker xử lý AI ngầm (Background AI Augmentation & Multi-Vector Indexing):
    1. Tải ảnh gốc của nhân sự từ MinIO Object Storage.
    2. Chạy pipeline tăng cường chất lượng ảnh (CLAHE + Adaptive Gamma).
    3. Sinh các biến thể đa góc độ & ánh sáng (Horizontal Flip, Tilt ±5°, Lighting Boost).
    4. Trích xuất vector 512 chiều bằng ArcFace cho từng biến thể, chuẩn hóa L2 và
       lưu bổ sung vào Qdrant để tăng độ nhạy nhận diện thực tế.
    """
    logger.info(
        f"Bắt đầu tăng cường dữ liệu AI (Multi-Embedding) từ ảnh '{image_name}' cho {student_code}..."
    )
    try:
        image_bytes = get_image_from_minio(image_name)
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            logger.warning(f"Không thể giải mã ảnh '{image_name}' từ MinIO")
            return False

        enhanced_img, _ = enhance_face_image(img)
        variants = generate_augmented_variants(enhanced_img)

        saved_count = 0
        for variant_name, variant_img in variants:
            try:
                results = DeepFace.represent(
                    img_path=variant_img,
                    model_name="ArcFace",
                    detector_backend="ssd",
                    enforce_detection=False,
                    align=True,
                )
                if results and "embedding" in results[0]:
                    upsert_augmented_embedding(
                        name=name or student_code,
                        student_code=student_code,
                        embedding_vector=results[0]["embedding"],
                        variant=variant_name,
                    )
                    saved_count += 1
            except Exception as inner_err:
                logger.warning(f"Bỏ qua biến thể {variant_name} của {student_code}: {inner_err}")

        logger.info(
            f"✅ Đã trích xuất và lưu thêm {saved_count} vector tăng cường (ArcFace 512D) vào Qdrant cho {student_code}!"
        )
        return True
    except Exception as e:
        logger.error(f"❌ Lỗi khi xử lý ngầm cho {student_code}: {e}")
        return False
