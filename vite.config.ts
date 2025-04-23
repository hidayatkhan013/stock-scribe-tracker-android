
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      // Explicitly mark Capacitor plugins as external - this prevents build errors
      // when they're imported but allows them to be used at runtime
      external: [
        '@capacitor/core',
        '@capacitor/filesystem',
        '@capacitor/toast'
      ]
    },
    commonjsOptions: {
      // These settings help with dynamic imports of Capacitor plugins
      transformMixedEsModules: true,
      exclude: [
        'node_modules/@capacitor/core/**',
        'node_modules/@capacitor/filesystem/**',
        'node_modules/@capacitor/toast/**'
      ]
    }
  },
  optimizeDeps: {
    // Exclude Capacitor plugins from optimization to avoid build issues
    exclude: ['@capacitor/core', '@capacitor/filesystem', '@capacitor/toast']
  }
}));
