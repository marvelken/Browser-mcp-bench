import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import { mockApi } from './src/api/server.ts';

function apiPlugin(): Plugin {
  return {
    name: 'mock-api',
    configureServer(server) {
      server.middlewares.use(mockApi());
    },
  };
}

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [],
      },
    }),
    apiPlugin(),
  ],
  server: {
    port: 5173,
    strictPort: true,
  },
});
