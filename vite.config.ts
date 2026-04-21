
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

const normalizeId = (id: string) => id.replace(/\\/g, '/');
const NODE_MODULES_SEGMENT = '/node_modules/';

const VENDOR_REACT_PACKAGES = ['react', 'react-dom', 'react-router', 'react-router-dom'];
const VENDOR_FLOW_PACKAGES = ['@xyflow/react'];
const VENDOR_CHARTS_PACKAGES = ['recharts', 'd3-'];
const VENDOR_UI_PACKAGES = [
  '@radix-ui/',
  'lucide-react',
  'sonner',
  'clsx',
  'tailwind-merge',
  'class-variance-authority',
  'cmdk',
  'date-fns',
  'embla-carousel-react',
  'input-otp',
  'motion',
  'react-day-picker',
  'react-dnd',
  'react-dnd-html5-backend',
  'react-hook-form',
  'react-resizable-panels',
  'vaul',
];

  export default defineConfig({
    plugins: [react(), tailwindcss()],
    resolve: {
      extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      target: 'esnext',
      outDir: 'build',
      rollupOptions: {
        output: {
          manualChunks(id) {
            const normalizedId = normalizeId(id);

            if (normalizedId.includes(NODE_MODULES_SEGMENT)) {
              if (VENDOR_REACT_PACKAGES.some((pkg) => normalizedId.includes(`${NODE_MODULES_SEGMENT}${pkg}/`))) {
                return 'vendor-react';
              }

              if (VENDOR_FLOW_PACKAGES.some((pkg) => normalizedId.includes(`${NODE_MODULES_SEGMENT}${pkg}/`))) {
                return 'vendor-flow';
              }

              if (VENDOR_CHARTS_PACKAGES.some((pkg) => normalizedId.includes(`${NODE_MODULES_SEGMENT}${pkg}`))) {
                return 'vendor-charts';
              }

              if (VENDOR_UI_PACKAGES.some((pkg) => normalizedId.includes(`${NODE_MODULES_SEGMENT}${pkg}`))) {
                return 'vendor-ui';
              }

              return 'vendor';
            }

            if (normalizedId.includes('/src/components/workgraph/')) return 'workgraph';
            if (normalizedId.includes('/src/components/timesheets/')) return 'timesheets';
            if (normalizedId.includes('/src/components/approvals/')) return 'approvals';
            if (normalizedId.includes('/src/components/invoices/')) return 'invoices';

            return undefined;
          },
        },
      },
    },
    server: {
      port: 3000,
      open: true,
    },
  });
