/**
 * Two build faces for one dual-face dsh plugin.
 *
 * The Host half is an ordinary ESM Node module: it registers listeners, drives
 * the renewal schedule, and registers exact Fetch routes on the Host
 * Connection, carrying no runtime import of any harness package. The vendored
 * authentication chain stays a runtime `require` of a file next to the built
 * artifact, so the bundle never inlines it and its global-shim load order is
 * preserved.
 *
 * The browser half is a closure factory: the Web client's module table owns
 * every bundle's execution, so the artifact must register itself through
 * `window.__ModuleLoader__.load` and resolve React and the harness baseline
 * packages through the `require` the table hands to the factory. The banner and
 * footer below supply that wrapper around rolldown's CommonJS output; the
 * declared externals keep those specifiers as `require(...)` calls instead of
 * inlining a second copy of React.
 *
 * `outExtensions` forces `lib/client.js` because the client scan reads the
 * exact path `package.json` exports, while this package's `"type": "module"`
 * would otherwise make tsdown emit the CommonJS artifact as `.cjs`. Neither
 * face cleans `lib/`: the two write into one directory and either could run
 * first.
 */
import { defineConfig } from 'tsdown'

/** Package name the browser module table keys this bundle by. */
const PLUGIN_ID = 'dsh-thu-automad'

/** Specifiers the browser module table resolves for a plugin bundle. */
const BROWSER_EXTERNALS: readonly (string | RegExp)[] = [
  'react',
  'react-dom',
  'react/jsx-runtime',
  'react-dom/client',
  /^@deepseek-ai\//u,
]

export default defineConfig([
  {
    name: `${PLUGIN_ID}/host`,
    entry: ['src/index.ts'],
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
    target: 'es2024',
    fixedExtension: false,
    dts: false,
    clean: false,
    sourcemap: true,
  },
  {
    name: `${PLUGIN_ID}/client`,
    entry: { client: 'src/client/index.ts' },
    outDir: 'lib',
    format: ['cjs'],
    platform: 'browser',
    target: 'es2022',
    dts: false,
    clean: false,
    sourcemap: true,
    deps: { neverBundle: [...BROWSER_EXTERNALS] },
    outExtensions: () => ({ js: '.js' }),
    banner: {
      js: `window.__ModuleLoader__.load({
\tid: ${JSON.stringify(PLUGIN_ID)},
\tfactory: (require) => {
\t\tvar module = { exports: {} };
\t\tvar exports = module.exports;
`,
    },
    footer: {
      js: `\t\treturn module.exports;
\t}
});
`,
    },
  },
])
