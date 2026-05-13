import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { fileURLToPath } from 'url';

export default defineConfig({
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

          if (id.includes('/antd/es/table') || id.includes('/antd/es/form')) {
            return 'vendor-antd-data-entry';
          }

          if (id.includes('/antd/es/menu') || id.includes('/antd/es/layout')) {
            return 'vendor-antd-navigation';
          }

          if (id.includes('/antd/')) {
            return 'vendor-antd-base';
          }

          if (id.includes('/@ant-design/icons/')) {
            return 'vendor-ant-icons';
          }

          if (id.includes('/rc-') || id.includes('/@rc-component/')) {
            return 'vendor-ant-rc';
          }

          if (id.includes('/@ant-design/x/')) {
            return 'vendor-antx';
          }

          if (id.includes('/echarts/') || id.includes('/echarts-for-react/')) {
            return 'vendor-echarts';
          }

          return 'vendor-misc';
        }
      }
    }
  },
  resolve: {
    alias: {
      crypto: fileURLToPath(new URL('./src/shims/crypto.ts', import.meta.url)),
      'node:crypto': fileURLToPath(new URL('./src/shims/crypto.ts', import.meta.url))
    }
  },
  plugins: [tailwindcss(), react()],
  server: {
    port: 5175
  }
});
