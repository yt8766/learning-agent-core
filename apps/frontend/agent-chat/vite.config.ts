import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';

// https://vite.dev/config/
export default defineConfig({
  plugins: [tailwindcss(), react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:3000',
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

          if (id.includes('/@ant-design/icons/')) {
            return 'vendor-ant-icons';
          }

          if (id.includes('/rc-') || id.includes('/@rc-component/')) {
            return 'vendor-ant-rc';
          }

          if (id.includes('/@ant-design/x-markdown/')) {
            return 'vendor-markdown';
          }

          if (id.includes('/@ant-design/x/')) {
            return 'vendor-antx';
          }

          if (id.includes('/axios/')) {
            return 'vendor-network';
          }

          return 'vendor-misc';
        }
      }
    }
  }
});
