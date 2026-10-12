// WASM-based SWC transform for lively.next browser transpilation.
// Loads the WASM module directly via fetch + WebAssembly.instantiateStreaming,
// bypassing SystemJS (which can't handle ES module glue code).

// Bootstrap chunks are re-executed when frozen modules revive. Keep the WASM
// instance and an in-flight initialization in the browser realm, not its recorder.
const wasmState = globalThis[Symbol.for('lively.swc.wasm-state')] ||= {
  exports: null, promise: null, failed: false
};

// --- Inlined wasm-bindgen glue (from lively_swc_browser.js) ---

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0 () {
  if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
    cachedUint8ArrayMemory0 = new Uint8Array(wasmState.exports.memory.buffer);
  }
  return cachedUint8ArrayMemory0;
}

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
cachedTextDecoder.decode();
const MAX_SAFARI_DECODE_BYTES = 2146435072;
let numBytesDecoded = 0;
function decodeText (ptr, len) {
  numBytesDecoded += len;
  if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
    cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
    cachedTextDecoder.decode();
    numBytesDecoded = len;
  }
  return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

function getStringFromWasm0 (ptr, len) {
  ptr = ptr >>> 0;
  return decodeText(ptr, len);
}

const cachedTextEncoder = new TextEncoder();
let WASM_VECTOR_LEN = 0;

function passStringToWasm0 (arg, malloc, realloc) {
  if (realloc === undefined) {
    const buf = cachedTextEncoder.encode(arg);
    const ptr = malloc(buf.length, 1) >>> 0;
    getUint8ArrayMemory0().subarray(ptr, ptr + buf.length).set(buf);
    WASM_VECTOR_LEN = buf.length;
    return ptr;
  }
  let len = arg.length;
  let ptr = malloc(len, 1) >>> 0;
  const mem = getUint8ArrayMemory0();
  let offset = 0;
  for (; offset < len; offset++) {
    const code = arg.charCodeAt(offset);
    if (code > 0x7F) break;
    mem[ptr + offset] = code;
  }
  if (offset !== len) {
    if (offset !== 0) arg = arg.slice(offset);
    ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
    const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
    const ret = cachedTextEncoder.encodeInto(arg, view);
    offset += ret.written;
    ptr = realloc(ptr, len, offset, 1) >>> 0;
  }
  WASM_VECTOR_LEN = offset;
  return ptr;
}

function takeFromExternrefTable0 (idx) {
  const value = wasmState.exports.__wbindgen_externrefs.get(idx);
  wasmState.exports.__externref_table_dealloc(idx);
  return value;
}

function wasmTransform (source, configJson) {
  let deferred4_0, deferred4_1;
  try {
    const ptr0 = passStringToWasm0(source, wasmState.exports.__wbindgen_malloc, wasmState.exports.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passStringToWasm0(configJson, wasmState.exports.__wbindgen_malloc, wasmState.exports.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasmState.exports.transform(ptr0, len0, ptr1, len1);
    let ptr3 = ret[0];
    let len3 = ret[1];
    if (ret[3]) {
      ptr3 = 0; len3 = 0;
      throw takeFromExternrefTable0(ret[2]);
    }
    deferred4_0 = ptr3;
    deferred4_1 = len3;
    return getStringFromWasm0(ptr3, len3);
  } finally {
    wasmState.exports.__wbindgen_free(deferred4_0, deferred4_1, 1);
  }
}

function wasmVersion () {
  let d0, d1;
  try {
    const ret = wasmState.exports.version();
    d0 = ret[0]; d1 = ret[1];
    return getStringFromWasm0(ret[0], ret[1]);
  } finally {
    wasmState.exports.__wbindgen_free(d0, d1, 1);
  }
}

// --- End inlined glue ---

/**
 * Initialize the SWC WASM module. Safe to call multiple times.
 * @param {string} [baseURL] - Base URL of the lively.next installation.
 */
export async function initWasm (baseURL) {
  if (wasmState.exports && !wasmState.failed) return;
  if (wasmState.promise) return wasmState.promise;

  wasmState.promise = (async () => {
    try {
      // Append a cache buster so that rebuilt WASM files are always fetched fresh.
      // We use the bootstrap script's URL hash (from the script tag) if available,
      // otherwise fall back to a fixed sentinel that can be bumped manually.
      const bootstrapScript = document.querySelector('script[src*="bootstrap-"]');
      const cacheBust = bootstrapScript
        ? bootstrapScript.src.replace(/.*bootstrap-([^.]+)\.js.*/, '$1')
        : '1';
      const wasmCacheBust = `${cacheBust}-swc6`;
      const wasmUrl = (baseURL || '').replace(/\/$/, '') +
        `/lively.freezer/swc-browser-wasm/lively_swc_browser_bg.wasm?v=${wasmCacheBust}`;
      console.log('[lively.swc] loading WASM from', wasmUrl);

      const imports = {
        wbg: {
          __wbg_Error_52673b7de5a0ca89: (arg0, arg1) => Error(getStringFromWasm0(arg0, arg1)),
          __wbindgen_init_externref_table: () => {
            const table = wasmState.exports.__wbindgen_externrefs;
            const offset = table.grow(4);
            table.set(0, undefined);
            table.set(offset + 0, undefined);
            table.set(offset + 1, null);
            table.set(offset + 2, true);
            table.set(offset + 3, false);
          }
        }
      };

      let instance;
      if (globalThis.livelyNative && wasmUrl.startsWith(livelyNative.baseURL)) {
        const { resourceClass } = await livelyNative.fileExtension();
        const bytes = await new resourceClass(wasmUrl.replace(/\?.*$/, '')).beBinary(true).read();
        ({ instance } = await WebAssembly.instantiate(bytes, imports));
      } else {
        const response = await fetch(wasmUrl);
        if (response.headers.get('content-type')?.includes('application/wasm')) {
          ({ instance } = await WebAssembly.instantiateStreaming(response, imports));
        } else {
          const bytes = await response.arrayBuffer();
          ({ instance } = await WebAssembly.instantiate(bytes, imports));
        }
      }
      wasmState.exports = instance.exports;
      cachedUint8ArrayMemory0 = null;
      wasmState.exports.__wbindgen_start();
      wasmState.failed = false;

      console.log('[lively.swc] WASM module loaded, version:', wasmVersion());
    } catch (err) {
      wasmState.failed = true;
      wasmState.promise = null;
      console.warn('[lively.swc] WASM load failed, will fall back to Babel:', err.message, err);
      throw err;
    }
  })();

  return wasmState.promise;
}

/**
 * Transform source code using the SWC WASM module.
 * @param {string} source - JavaScript source code
 * @param {object} config - LivelyTransformConfig fields (camelCase)
 * @returns {{ code: string, map: string } | null} - null if WASM unavailable
 */
export function swcTransform (source, config) {
  if (!wasmState.exports || wasmState.failed) return null;
  try {
    const resultJson = wasmTransform(source, JSON.stringify(config));
    return JSON.parse(resultJson);
  } catch (err) {
    console.warn('[lively.swc] transform failed, falling back:', err.message);
    return null;
  }
}

/** @returns {boolean} Whether WASM was successfully loaded */
export function isAvailable () {
  return wasmState.exports !== null && !wasmState.failed;
}
