# Basis Universal decoder: pinned CSP-safe derivative

Camber Reign uses a locally modified JavaScript wrapper from **Three.js 0.186.1**, with the original WebAssembly decoder unchanged. This is a narrow adaptation of the pinned synchronous Basis bindings, not a new upstream Basis build or a general Emscripten compatibility layer.

The active JS/Wasm pair lives in the `csp-<JavaScript SHA-256 prefix>/` directory named by `src/basis-transcoder-manifest.js`. Both URLs change when the wrapper changes, so cached copies of the previous incompatible decoder cannot be reused. Original unversioned decoder copies are intentionally not shipped.

## Why it is modified

The stock wrapper dynamically creates JavaScript invokers through `Function`. Camber Reign permits WebAssembly compilation with `wasm-unsafe-eval`, but does **not** permit JavaScript `unsafe-eval`. A blob worker inherits that policy. The original wrapper therefore fails at runtime; Three's legacy worker initialization does not itself settle its waiting texture tasks on that failure.

`scripts/prepare-csp-transcoder.mjs` checks exact upstream JS and Wasm SHA-256 values before making these deterministic changes:

- Replace `craftInvokerFunction` and `__emval_get_method_caller` dynamic generation with ordinary closures adapted from the official Emscripten **3.1.51** `DYNAMIC_EXECUTION=0` branches. Argument conversion, arity checking, destructor handling, return conversion, and constructor calls remain explicit. Invocation-local temporary arrays allow reentrant calls. Only synchronous bindings are supported; an asynchronous binding is rejected explicitly. The pinned Basis module exposes no asynchronous binding in the tested initialization/transcoding paths.
- Replace the legacy dynamically evaluated global-object fallback with `globalThis`.
- Bridge factory initialization rejection to a `basis-init-error` worker message, which the application's bounded loader handles before the normal worker queue listener.

The Wasm binary is byte-for-byte identical to the pinned Three package. Changing Three or either pinned upstream hash requires a fresh source review and the decoder comparisons below. The asset preparation script invokes this generator and cannot silently restore stock dynamic-code bindings.

## Provenance and licenses

- [Basis Universal](https://github.com/BinomialLLC/basis_universal), Apache 2.0: `BASIS-LICENSE.txt`.
- [Three.js](https://github.com/mrdoob/three.js), MIT: `THREE-LICENSE.txt`.
- Closure adaptation: [Emscripten 3.1.51 embind.js](https://github.com/emscripten-core/emscripten/blob/3.1.51/src/embind/embind.js) and [emval.js](https://github.com/emscripten-core/emscripten/blob/3.1.51/src/embind/emval.js). Full MIT/NCSA notices: `EMSCRIPTEN-LICENSE.txt`.

All notices are retained alongside the derivative. Car authors, original source URLs and asset licenses remain unchanged in their GLBs and manufacturer manifest.

## Verification and failure behavior

Regenerate with `node scripts/prepare-csp-transcoder.mjs`. Run `node --test tests/basis-transcoder-csp.test.js tests/bounded-ktx2-loader.test.js tests/manufacturer-compressed-runtime.test.js`.

The actual decoder test disables JavaScript string code generation and allows Wasm: the unmodified wrapper reproduces the rejection, while the derivative initializes. It compares **all 94 shipping KTX2 images**, all ten mips each, in **ETC1 RGB, ETC2 RGBA, BC1, BC3, BC7 and ASTC 4x4**: 564 image/format chains and **5,640 mip payloads** match the original decoder byte-for-byte. It also tests the actual worker-style initialization callback and a rejected Wasm initialization. This validates output equivalence, not physical-device frame time or battery use.

`BoundedKTX2Loader` caps the shared pool at two workers and each queued/decode operation at 15 seconds. Startup rejection, worker errors, decode errors and deadlines reject all outstanding operations, terminate the pool, release late results and permanently disable compression for that page session. The manufacturer loader disposes a partially loaded compressed car and retries its original WebP variant, including when GLTFLoader swallows an individual map failure. CSP remains strict; no JavaScript `unsafe-eval` is introduced.
