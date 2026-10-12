
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

const normalizeId = (id: string) => id.replace(/\\/g, '/');
const NODE_MODULES_SEGMENT = '/node_modules/';

// Keep React and the packages it (and react-router) import in one chunk.
// react-dom imports scheduler; react-router imports cookie and set-cookie-parser.
// If those land in `vendor`, Rollup emits a vendor <-> vendor-react cycle.
// vendor then pulls vendor-charts, which pulls vendor-ui, and Radix/recharts
// call React.forwardRef while the react export is still uninitialized.
// That is the production blank page: "Cannot read properties of undefined (reading 'forwardRef')".
const VENDOR_REACT_PACKAGES = [
  'react',
  'react-dom',
  'react-router',
  'react-router-dom',
  'scheduler',
  'loose-envify',
  'cookie',
  'set-cookie-parser',
];
const VENDOR_FLOW_PACKAGES = ['@xyflow/react'];
// victory-vendor re-exports d3. It must stay with the d3/recharts chunk.
// Otherwise vendor <-> vendor-charts cycles, and the production build throws
// "Cannot access 'X' before initialization" before React renders.
const VENDOR_CHARTS_PACKAGES = ['recharts', 'd3-', 'victory-vendor'];
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
