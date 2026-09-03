// Used only by jest (via babel-jest) so the ESM source in src/ can run under Node during tests.
// The rollup build does not use @rollup/plugin-babel (see rollup.config.js), so this file has no
// effect on the published dist/ bundles.
module.exports = {
    presets: [['@babel/preset-env', { targets: { node: 'current' } }]],
};
