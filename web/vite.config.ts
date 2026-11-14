import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Must match the API's PORT (default 8790, which avoids 8787, a port other local tools often hold).
const apiPort = process.env.PORT ?? '8790';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Listen on the LAN too so the app can be opened from a phone during the demo.
    host: true,
    proxy: { '/api': `http://localhost:${apiPort}` },
  },
});
