const babel = require('@babel/core');
const { minify } = require('terser');

module.exports = async function (code, useTerser = true) {
  if (!useTerser) {
    const { swcMinify } = await import('./bundler-swc.js');
    return { code, min: (await swcMinify(code)).code };
  }
  const transformed = babel.transformSync(code, {
    babelrc: false,
    configFile: false,
    presets: [[require.resolve('@babel/preset-env'), { modules: false }]]
  });
  const result = await minify(transformed.code, {
    compress: true, mangle: true, ecma: 5, format: { comments: false }
  });
  return { code, min: result.code };
};
