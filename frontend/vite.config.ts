import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/list-apps': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true,
      },
      '/apps': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true,
      },
      '/run': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true,
      },
      '/images': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true,
      },
    },
  },
});
