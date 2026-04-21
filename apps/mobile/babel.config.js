module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'babel-plugin-module-resolver',
        {
          root: ['.'],
          alias: {
            '@wrap-roll/contracts': '../../libs/contracts/src/index.ts',
          },
          extensions: ['.ios.js', '.android.js', '.js', '.jsx', '.json', '.tsx', '.ts'],
        },
      ],
      'react-native-reanimated/plugin',
    ],
  };
};
