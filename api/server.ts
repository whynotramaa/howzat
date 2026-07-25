// Every /api/* request is rewritten here by vercel.json, websocket upgrades
// included, and served by the http.Server exported below. The rewrite keeps
// the original request path, so Express still routes on it.
//
// A static filename rather than a [...path] catch-all: the catch-all matched
// only a single path segment, so /api/health resolved but /api/health/live
// 404'd at the platform before ever reaching Express.
//
// The implementation lives in the api workspace so that it is covered by the
// same `tsc -b` project as the rest of the server; this file only re-exports it.
//
// It points at the tsup bundle rather than the source: files under api/ are
// transpiled individually, so a relative import of a .ts file outside this
// directory resolves to nothing at runtime. The build command produces this.
// Emitted by `npm run build --workspace @howzat/api`, which the build command
// runs before this file is compiled.
export { default } from '../apps/api/dist/vercel.js';
