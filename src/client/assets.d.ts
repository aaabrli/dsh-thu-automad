/** esbuild resolves `*.svg` imports to their file contents as text. */
declare module '*.svg' {
  const source: string
  export default source
}