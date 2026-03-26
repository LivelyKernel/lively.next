/* tslint:disable */
/* eslint-disable */

/**
 * Transform JavaScript source code using lively.next's SWC transforms,
 * then wrap in System.register() format for SystemJS module loading.
 *
 * # Arguments
 * * `source` - The JavaScript source code to transform
 * * `config_json` - JSON string matching `LivelyTransformConfig`
 *
 * # Returns
 * JSON string: `{ "code": "...", "map": "..." }`
 */
export function transform(source: string, config_json: string): string;

/**
 * Returns the version of the transforms library.
 */
export function version(): string;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly transform: (a: number, b: number, c: number, d: number) => [number, number, number, number];
  readonly version: () => [number, number];
  readonly __wbindgen_externrefs: WebAssembly.Table;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
  readonly __externref_table_dealloc: (a: number) => void;
  readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
*
* @returns {InitOutput}
*/
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
