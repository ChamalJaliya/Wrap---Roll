const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
const { join } = require('path');

module.exports = {
  output: {
    path: join(__dirname, '../../dist/services/api-worker'),
    clean: true,
  },
  resolve: {
    extensions: ['.ts', '.js', '.mjs'],
  },
  plugins: [
    new NxAppWebpackPlugin({
      target: 'node',
      compiler: 'tsc',
      main: './src/worker.main.ts',
      tsConfig: './tsconfig.app.json',
      assets: ['./src/assets'],
      optimization: false,
      outputHashing: 'none',
      generatePackageJson: true,
      sourceMap: true,
      runtimeDependencies: ['@wrap-roll/contracts', '@wrap-roll/order-kit'],
    }),
  ],
  externals: [
    ({ request }, callback) => {
      if (request && request.startsWith('@wrap-roll/')) {
        return callback();
      }
      if (request && (request.startsWith('.') || request.startsWith('..'))) {
        return callback();
      }
      return callback(null, `commonjs ${request}`);
    },
  ],
};
