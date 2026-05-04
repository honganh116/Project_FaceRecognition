// src/pages/AdminDashboard.jsx
import React, { useEffect, useState } from 'react';

const AdminDashboard = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/logs');
      const data = await response.json();
      setLogs(data.data || []);
      setLoading(false);
    } catch (error) {
      console.error("Lỗi lấy dữ liệu chấm công:", error);
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '40px', fontFamily: 'sans-serif' }}>
      <h2>⚙️ Bảng Điều Khiển Quản Trị (Admin)</h2>
      <p>Lịch sử điểm danh / nhận diện gần nhất</p>
      
      {loading ? (
        <p>Đang tải dữ liệu...</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px' }}>
          <thead>
            <tr style={{ backgroundColor: '#f4f4f4', textAlign: 'left' }}>
              <th style={{ padding: '12px', borderBottom: '2px solid #ddd' }}>Họ và Tên</th>
              <th style={{ padding: '12px', borderBottom: '2px solid #ddd' }}>Mã Sinh Viên</th>
              <th style={{ padding: '12px', borderBottom: '2px solid #ddd' }}>Thời Gian (Time Logged)</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log, index) => (
              <tr key={index}>
                <td style={{ padding: '12px', borderBottom: '1px solid #ddd' }}>{log.name}</td>
                <td style={{ padding: '12px', borderBottom: '1px solid #ddd' }}>{log.student_code}</td>
                <td style={{ padding: '12px', borderBottom: '1px solid #ddd' }}>{log.time}</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr><td colSpan="3" style={{ textAlign: 'center', padding: '20px' }}>Chưa có dữ liệu.</td></tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default AdminDashboard;