import { defineConfig } from 'vite';
import { resolve } from 'node:path';

import pkg from './package.json';

export default defineConfig({
  // Substitutes the package version into `src/version.ts`, so a built copy can
  // say which one it is.
  //
  // Read from package.json rather than `process.env.npm_package_version`, which
  // npm only sets when the build runs through an npm script — a bare
  // `vite build` or `npx vitest` would leave it undefined and silently ship the
  // fallback. Reading the manifest works however the build was invoked.
  //
  // `define` rather than importing package.json inside `src/`: that import
  // would inline the entire manifest, dependency list and all, into every
  // bundle.
  define: {
    __ARTOOLKIT5_TS_VERSION__: JSON.stringify(pkg.version),
  },

  // Development server: serve examples in dev mode
  server: {
    open: '/examples/index.html',
  },

  // `public/` holds assets for the dev server and examples. Copying them into
  // dist would publish them as part of the library — favicon.svg was ending up
  // in the npm tarball.
  publicDir: false,

  // Build configuration: outputs a library (not an app)
  build: {
    outDir: 'dist',
    emptyOutDir: true,

    // Library mode: generates ES modules and UMD
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'ARToolkit5TS',
      fileName: 'artoolkit5-ts',
      formats: ['es', 'umd'],
    },

    // Rollup options for external dependencies
    rollupOptions: {
      // Keep artoolkit5-wasm out of the bundle. It is an ordinary dependency,
      // not a peer one, so npm installs it for consumers either way — external
      // only means the `.wasm` binary is fetched once and cached rather than
      // copied into every bundle that depends on this package.
      external: ['@ar-js-org/artoolkit5-wasm'],

      output: {
        // UMD global names for browser <script> usage
        globals: {
          '@ar-js-org/artoolkit5-wasm': 'ARToolkit5Wasm',
        },
      },
    },
  },
});