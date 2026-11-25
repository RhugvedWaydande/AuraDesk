// vite.config.js — configuration for the Vite dev server & build tool.
// Vite is what gives you the instant `npm run dev` local server with hot reload.
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()], // teaches Vite how to understand React's JSX syntax
  server: {
    host: '0.0.0.0',   // listen on all network interfaces (needed for previews/containers)
    port: 5173,        // Vite's default port
    allowedHosts: true // accept requests from any hostname (safe for dev only)
  }
})
