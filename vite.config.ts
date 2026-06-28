import { defineConfig } from 'vite'
import { resolve } from 'node:path'

export default defineConfig({
  server: {
    open: '/examples/webcam/index.html', // Automatically opens this page
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'ARToolkit5TS',
      fileName: 'artoolkit5-ts',
      formats: ['es', 'umd'],
    },
    rollupOptions: {
      // Declare the dependency as external to keep the import clean
      external: [
        '@ar-js-org/artoolkit5-wasm',
        '@ar-js-org/artoolkit5-wasm/loader'
      ],
      output: {
        // Specify global variable names for the UMD build
        globals: {
          '@ar-js-org/artoolkit5-wasm': 'ARToolkit5Wasm',
          '@ar-js-org/artoolkit5-wasm/loader': 'ARToolkit5WasmLoader'
        }
      }
    }
  },
})