import { defineConfig } from 'vite';
import { resolve } from 'path'
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import dts from 'vite-plugin-dts'

export default defineConfig({
  plugins: [nodePolyfills(), dts({ rollupTypes: true })],
  build: {
    target: 'modules',
    lib: {
      // Could also be a dictionary or array of multiple entry points
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'PEA',
      // the proper extensions will be added
      fileName: 'bundle',
      
    },
  },
  resolve: {
    alias: {
      "@": "/src",
      "@state/*": "/src/state/*",
      "@types/*": "/src/types/*",
    },
  },
});