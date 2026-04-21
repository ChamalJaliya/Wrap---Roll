const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
const { join } = require('path');

module.exports = {
  output: {
    path: join(__dirname, '../../dist/services/api'),
    clean: true,
  },
  resolve: {
    extensions: ['.ts', '.js', '.mjs'],
  },
  plugins: [
    new NxAppWebpackPlugin({
      target: 'node',
      compiler: 'tsc',
      main: './src/main.ts',
      tsConfig: './tsconfig.app.json',
      assets: ['./src/assets'],
      optimization: false,
      outputHashing: 'none',
      generatePackageJson: true,
      sourceMap: true,
      // Injects OpenAPI metadata at compile time (DTOs + controller methods); see @nestjs/swagger docs.
      transformers: [
        {
          name: '@nestjs/swagger/plugin',
          options: {
            dtoFileNameSuffix: ['.dto.ts', '.entity.ts'],
            controllerFileNameSuffix: ['.controller.ts'],
            classValidatorShim: true,
            introspectComments: true,
          },
        },
      ],
      // Ship workspace packages that resolve to compiled JS (e.g. @wrap-roll/contracts dist/).
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
