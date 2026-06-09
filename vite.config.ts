import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig(() => {
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        react(),
        tailwindcss(),
        visualizer({
          filename: 'dist/bundle-visualizer.html',
          template: 'treemap',
          gzipSize: true,
          brotliSize: true,
          open: false,
        }),
      ],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
      ,
      build: {
        rollupOptions: {
          output: {
            // Manual chunking to reduce main bundle size
            manualChunks(id: string) {
              if (!id.includes('node_modules')) return;

              const normalizedId = id.split('node_modules')[1];
              if (!normalizedId) return;

              if (/[\\/]recharts([\\/]|$)/.test(normalizedId)) return 'vendor-recharts';
              if (normalizedId.includes('@supabase')) return 'vendor-supabase';
              if (normalizedId.includes('i18next') || normalizedId.includes('react-i18next')) return 'vendor-i18n';
              if (normalizedId.includes('lodash') || normalizedId.includes('date-fns')) return 'vendor-utils';
              return 'vendor';
            }
          }
        }
      }
    };
});
