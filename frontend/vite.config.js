import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// In development the app calls /api on its own address and Vite forwards it to the backend, so the
// browser never needs the backend's URL (and no CORS set-up is needed). VITE_DEV_API_TARGET overrides it.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    server: {
      host: '127.0.0.1',
      port: 5174,
      proxy: { '/api': { target: env.VITE_DEV_API_TARGET || 'http://127.0.0.1:4010', changeOrigin: true } }
    },
    preview: { host: '127.0.0.1', port: 5174 }
  };
});
