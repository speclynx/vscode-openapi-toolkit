module.exports = {
  ignore: ['**/*.d.ts'],
  presets: [
    [
      '@babel/preset-env',
      {
        targets: { node: '16.14.2' },
        modules: 'auto', // let Webpack convert imports to CommonJS
        useBuiltIns: false, // no global polyfills in VS Code
      },
    ],
    '@babel/preset-typescript',
  ],
};
