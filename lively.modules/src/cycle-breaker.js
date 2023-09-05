'format esm';
// this module's purpose is to hold references that cause cyclical references
// and screw up the build process of rollup. This is a dirty hack, that should
// be removed as soon as possible from the system.

let classHolder = classHolder || {};

export { classHolder };
