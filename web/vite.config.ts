import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Listen on the LAN too so the app can be opened from a phone during the demo.
    host: true,
    proxy: { '/api': 'http://localhost:8787' },
  },
});
