import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node20',
  platform: 'node',
  sourcemap: true,
  clean: true,
  dts: false,
  // @howzat/shared ships TypeScript source, so it must be bundled rather
  // than left as a runtime import Node cannot resolve.
  noExternal: ['@howzat/shared'],
});
