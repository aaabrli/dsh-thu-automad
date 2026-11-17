/** Build the Node host module and the DSH browser module factory. */
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