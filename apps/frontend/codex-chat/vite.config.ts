import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [tailwindcss(), react()],
  server: {
    port: 5171,
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET ?? 'http://127.0.0.1:3000',
        changeOrigin: true
      }
    }
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined;
          }

          if (id.includes('/react/') || id.includes('/react-dom/')) {
            return 'vendor-react';
          }

          if (id.includes('/antd/')) {
            return 'vendor-antd-core';
          }

          if (id.includes('/@ant-design/x-card/')) {
            return 'vendor-x-card';
          }

          if (id.includes('/@ant-design/x-markdown/')) {
            return 'vendor-markdown';
          }

          if (id.includes('/@ant-design/x/')) {
            return 'vendor-antx';
          }

          return 'vendor-misc';
        }
      }
    }
  }
});
