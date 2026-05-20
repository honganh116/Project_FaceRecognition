import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/admin/', // Đã thêm dòng này để cấu hình subpath cho Admin
  plugins: [react()],
  server: {
    port: 3000,
    host: true // Để Docker có thể map port ra ngoài
  }
})