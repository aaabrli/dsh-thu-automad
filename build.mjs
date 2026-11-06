/**
 * Local build for this fork.
 *
 * Upstream builds with `tsdown` from inside the dsh monorepo, where the harness
 * packages and dev dependencies are already installed. This fork lives in its
 * own directory, so it reproduces the two build faces with esbuild instead:
 *
 * - Host: one ESM Node module, `lib/index.js`. Harness packages are type-only
 *   imports and therefore erased; the vendored authentication chain stays a
 *   runtime `require` of a file next to the built artifact, so it is never
 *   inlined and its global-shim load order is preserved.
 * - Client: one CommonJS bundle wrapped in the module-table factory the Web
 *   client expects, `lib/client.js`. React and every `@deepseek-ai/*` specifier
 *   stay `require(...)` calls resolved by that table.
 *
 * Build: `node build.mjs` (requires esbuild in `node_modules`).
 */
import { build } from 'esbuild'

/** Package id the browser module table keys this bundle by. */
const PLUGIN_ID = 'dsh-thu-automad'

/** Specifiers the browser module table resolves for a plugin bundle. */
const BROWSER_EXTERNALS = [
  'react',
  'react-dom',
  'react/jsx-runtime',
  'react-dom/client',
  '@deepseek-ai/*',
]

/** Wrapper the Web client's module table expects around a plugin bundle. */
const CLIENT_BANNER = `window.__ModuleLoader__.load({
\tid: ${JSON.stringify(PLUGIN_ID)},
\tfactory: (require) => {
\t\tvar module = { exports: {} };
\t\tvar exports = module.exports;
`

/** Closes the factory and the module-table entry. */
const CLIENT_FOOTER = `\t\treturn module.exports;
\t}
});
`

await build({
  entryPoints: ['src/index.ts'],
  outfile: 'lib/index.js',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'es2024',
  sourcemap: true,
  packages: 'external',
  logLevel: 'info',
})

await build({
  entryPoints: { client: 'src/client/index.ts' },
  outfile: 'lib/client.js',
  bundle: true,
  platform: 'browser',
  format: 'cjs',
  target: 'es2022',
  sourcemap: true,
  external: BROWSER_EXTERNALS,
  loader: { '.svg': 'text' },
  jsx: 'automatic',
  banner: { js: CLIENT_BANNER },
  footer: { js: CLIENT_FOOTER },
  logLevel: 'info',
})