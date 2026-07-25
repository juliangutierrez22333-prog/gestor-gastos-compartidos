import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    // El frontend llama a /api con URLs relativas y Vite reenvía al backend:
    // para el navegador todo es el mismo origen, así no hace falta CORS ni
    // hardcodear la URL del servidor en el código del cliente.
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});
