import { defineConfig } from 'tsup';

export default defineConfig({
  // index.ts is the long-lived server; vercel.ts is the serverless export.
  // Both are bundled because the serverless platform compiles the files under
  // api/ one at a time and will not follow a relative TypeScript import out of
  // that directory — it needs a single emitted .js to point at.
  entry: ['src/index.ts', 'src/vercel.ts'],
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
