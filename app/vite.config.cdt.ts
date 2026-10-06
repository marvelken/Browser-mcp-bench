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

function cdtEntryPlugin(): Plugin {
  return {
    name: 'cdt-entry',
    transformIndexHtml(html) {
      return html.replace('/src/main.tsx', '/src/main-cdt.tsx');
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
    cdtEntryPlugin(),
  ],
  server: {
    port: 5173,
    strictPort: true,
  },
});
