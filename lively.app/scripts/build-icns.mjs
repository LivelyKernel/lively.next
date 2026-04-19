#!/usr/bin/env node
// Pack a set of square PNGs into an Apple .icns file. Pure Node, no
// dependencies — libicns was dropped from Ubuntu 24.04 so we can't rely
// on png2icns. The .icns format is just a 4-byte magic + 4-byte big-endian
// total size, then a sequence of chunks of the form:
//   <4-byte type code><4-byte big-endian size (header + data)><png bytes>
// Type codes map to icon sizes:
//   16→icp4  32→icp5  64→icp6  128→ic07  256→ic08  512→ic09  1024→ic10
//
// Usage: node build-icns.mjs <out.icns> <src-dir>/16.png [32.png ...]
// (Filenames only matter to infer size — must be numbered <size>.png.)

import fs from 'node:fs';
import path from 'node:path';

const SIZE_TO_TYPE = {
  16: 'icp4', 32: 'icp5', 64: 'icp6',
  128: 'ic07', 256: 'ic08', 512: 'ic09', 1024: 'ic10'
};

const [, , outFile, ...inputs] = process.argv;
if (!outFile || inputs.length === 0) {
  console.error('usage: build-icns.mjs out.icns size1.png size2.png ...');
  process.exit(2);
}

const chunks = [];
let dataSize = 0;
for (const pngPath of inputs) {
  const size = Number(path.basename(pngPath, '.png'));
  const type = SIZE_TO_TYPE[size];
  if (!type) { console.warn(`skipping ${pngPath} — size ${size}px has no icns type`); continue; }
  const png = fs.readFileSync(pngPath);
  const header = Buffer.alloc(8);
  header.write(type, 0, 4, 'ascii');
  header.writeUInt32BE(png.length + 8, 4);
  chunks.push(Buffer.concat([header, png]));
  dataSize += png.length + 8;
}

const top = Buffer.alloc(8);
top.write('icns', 0, 4, 'ascii');
top.writeUInt32BE(dataSize + 8, 4);

fs.writeFileSync(outFile, Buffer.concat([top, ...chunks]));
console.log(`wrote ${outFile} (${chunks.length} sizes, ${dataSize + 8} bytes)`);
