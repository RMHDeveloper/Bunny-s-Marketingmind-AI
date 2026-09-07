import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    // Accept any of the common names, whether it comes from .env.local (local dev)
    // or from the host's build-time environment (e.g. Vercel project env vars).
    const geminiKey =
      env.VITE_GEMINI_API_KEY || env.GEMINI_API_KEY || env.API_KEY || '';
    const geminiModel =
      env.VITE_GEMINI_MODEL || env.GEMINI_MODEL || 'gemini-flash-latest';
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        // Baked in as plain string literals at build time so the browser can
        // read them regardless of `import.meta.env` / `process` availability.
        __GEMINI_API_KEY__: JSON.stringify(geminiKey),
        __GEMINI_MODEL__: JSON.stringify(geminiModel),
        'process.env.API_KEY': JSON.stringify(geminiKey),
        'process.env.GEMINI_API_KEY': JSON.stringify(geminiKey),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
