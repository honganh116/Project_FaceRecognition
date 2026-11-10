-- Khởi tạo Schema chuẩn cho Hệ thống Nhận diện Khuôn mặt AI Enterprise v3.0 (PostgreSQL)

CREATE TABLE IF NOT EXISTS face_profiles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    student_code VARCHAR(50) UNIQUE NOT NULL,
    image_url VARCHAR(255) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_face_profiles_student_code ON face_profiles(student_code);

CREATE TABLE IF NOT EXISTS attendance (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    student_code VARCHAR(50) NOT NULL,
    time_logged VARCHAR(50) NOT NULL,
    status VARCHAR(50) DEFAULT 'Đúng giờ',
    check_type VARCHAR(30) DEFAULT 'Check-in',
    work_hours FLOAT DEFAULT 0.0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_attendance_student_code ON attendance(student_code);
CREATE INDEX IF NOT EXISTS idx_attendance_created_at ON attendance(created_at);

CREATE TABLE IF NOT EXISTS settings (
    key VARCHAR(100) PRIMARY KEY,
    value VARCHAR(255) NOT NULL
);

INSERT INTO settings (key, value)
VALUES ('shift_time', '08:00'), ('shift_end_time', '17:30')
ON CONFLICT (key) DO NOTHING;
