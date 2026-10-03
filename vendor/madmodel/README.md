# Vendored Tsinghua authentication chain

Byte-identical copies of the reverse-engineered authentication chain this plugin
signs in with. They are not this package's code, they are not modified, and they
are loaded at runtime through `createRequire` from `src/auth/chain.ts`.

| File | Source | SHA-256 |
|---|---|---|
| `madmodel-auth.js` | `madmodel-proxy` v1.10.3, file `madmodel-auth.js` | `7dbfde1d6453f54392ba4325178e203d9c718ec921cefd61287e7621cbae09ba` |
| `sm2.js` | `madmodel-proxy` v1.10.3, file `sm2.js` (its own copy of sm-crypto v0.3.13) | `1ac60195da5994572e48d77f5e5aa6b5c0e98939023f62f0e8a2739b6df78791` |

## Why a copy rather than a reimplementation

The chain is protocol knowledge, not logic: SM2-encrypted password submission,
the school's `doubleAuth` handshake, the ticket-redemption endpoint, and the
WebVPN tunnel derivation. `sm2.js` alone is 37 KB of elliptic-curve arithmetic
that this package must not rewrite. Reimplementing any of it would be a large,
untestable surface whose only observable failure is "login stopped working".

## Why `package.json` sits here

The owning package declares `"type": "module"`, which would make a `.js` file in
this directory an ES module — and `require()` of an ES module from
`createRequire` fails on the file's first line. This directory's own
`package.json` marks it CommonJS so the two files under it stay byte-identical.
Without that marker the alternative would be renaming both to `.cjs` and editing
`madmodel-auth.js`'s `require('./sm2.js')`, which would break the hashes above.

## Why the load order matters

`madmodel-auth.js` installs a `globalThis.window.crypto` shim *before* it
evaluates `sm2.js`, because that library seeds its entropy pool at evaluation
time and would otherwise fall back to `Math.random` for the bytes that encrypt
the password. A static `import` would hoist the `sm2.js` evaluation above the
shim and weaken the ciphertext silently, which is why `src/auth/chain.ts` uses
`createRequire` and documents the constraint there.

## Updating

Re-copy both files, re-run `shasum -a 256`, and update the table above. A change
here is a change to the school's protocol surface; the plugin's own code should
not need to move with it unless an exported name changed.

## Scope

`madmodel-auth.js` also implements the WebVPN and info-portal roaming paths,
which this plugin never calls: `src/auth/login.ts` uses only
`MadmodelAuthClient.authenticateIdentity` plus the direct ticket redemption that
`auth-probe/direct-login.js` validated against the live school.
