'use strict';

const path = require('node:path');
const merge = require('merge-options');
const { BuildPathGuardPlugin } = require('./config/webpack-build-paths.cjs');
const { optimize } = require('webpack');
const TerserPlugin = require('terser-webpack-plugin');

function treeSitterRuntimeRule(runtime) {
  return {
    test: /node_modules[/\\]web-tree-sitter[/\\]web-tree-sitter\.js$/,
    use: {
      loader: path.join(__dirname, 'config/tree-sitter-runtime-loader.cjs'),
      options: { runtime },
    },
  };
}

function withBuildPathGuard(defaults, overrides) {
  const config = merge(defaults, overrides);
  // Append after merging so target-specific plugin lists cannot drop the guard.
  config.plugins = [...(config.plugins || []), new BuildPathGuardPlugin(__dirname)];
  return config;
}

function withNodeDefaults(extConfig) {
  const defaultConfig = {
    mode: 'production',
    target: 'node', // build for Node/Electron
    node: {
      __dirname: false, // leave the __dirname-behaviour intact
      __filename: false, // tree-sitter must use the installed bundle filename
    },
    output: {
      libraryTarget: 'commonjs', // VS Code expects CommonJS
    },
    optimization: {
      minimize: true,
      minimizer: [
        new TerserPlugin({
          extractComments: false,
          terserOptions: {
            format: {
              comments: false,
            },
            mangle: true,
            keep_classnames: true,
          },
        }),
      ],
    },
    resolve: {
      conditionNames: ['import', 'require', 'node-addons', 'node'],
      mainFields: ['module', 'main'],
      extensions: ['.ts', '.js'],
      extensionAlias: {
        // this is needed to resolve dynamic imports that now require the .js extension
        '.js': ['.js', '.ts'],
      },
    },
    module: {
      rules: [
        treeSitterRuntimeRule('node'),
        {
          test: /\.wasm$/,
          type: 'javascript/auto',
          use: 'null-loader',
        },
        {
          test: /\.ts$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              rootMode: 'upward',
            },
          },
        },
        {
          // Treat nimma's legacy/esm helpers as real ES-modules
          test: /node_modules[/\\]nimma[/\\]dist[/\\]legacy[/\\]esm[/\\].+\.js$/,
          type: 'javascript/esm',
        },
      ],
    },
    externalsPresets: { node: true }, // don’t bundle Node built-ins
    externals: [
      {
        electron: 'commonjs electron', // keep the Electron as external
        vscode: 'commonjs vscode', // keep the VS Code API external
        fsevents: 'commonjs fsevents', // keep fsevents external (only used on macOS)
      },
    ],
    devtool: false,
    plugins: nodePlugins(extConfig.context),
  };

  return withBuildPathGuard(defaultConfig, extConfig);
}

function nodePlugins() {
  return [
    new optimize.LimitChunkCountPlugin({
      maxChunks: 1,
    }),
  ];
}

function withBrowserDefaults(extConfig) {
  const defaultConfig = {
    mode: 'production',
    target: 'webworker', // extensions run in a webworker context
    resolve: {
      mainFields: ['browser', 'module', 'main'],
      extensions: ['.ts', '.js'], // support ts-files and js-files
      extensionAlias: {
        // this is needed to resolve dynamic imports that now require the .js extension
        '.js': ['.js', '.ts'],
      },
      fallback: {
        fs: false,
        path: false,
        module: false,
      },
    },
    module: {
      rules: [
        treeSitterRuntimeRule('browser'),
        {
          test: /\.wasm$/,
          type: 'javascript/auto',
          use: 'null-loader',
        },
        {
          test: /\.ts$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              rootMode: 'upward',
            },
          },
        },
      ],
    },
    externals: {
      vscode: 'commonjs vscode', // ignored because it doesn't exist
      fsevents: 'commonjs fsevents', // keep fsevents external (only used on macOS)
    },
    performance: {
      hints: false,
    },
    output: {
      libraryTarget: 'commonjs',
      devtoolModuleFilenameTemplate: '../[resource-path]',
    },
    optimization: {
      minimize: true,
      minimizer: [
        new TerserPlugin({
          extractComments: false,
          terserOptions: {
            format: {
              comments: false,
            },
            mangle: true,
            keep_classnames: true,
          },
        }),
      ],
    },
    devtool: false,
    plugins: browserPlugins(extConfig.context),
  };

  return withBuildPathGuard(defaultConfig, extConfig);
}

function browserPlugins() {
  return [
    new optimize.LimitChunkCountPlugin({
      maxChunks: 1,
    }),
  ];
}

module.exports = {
  node: withNodeDefaults,
  nodePlugins,
  browser: withBrowserDefaults,
  browserPlugins,
};
