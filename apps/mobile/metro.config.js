const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);
const rootNodeModules = path.resolve(workspaceRoot, 'node_modules');

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  rootNodeModules,
];
config.resolver.extraNodeModules = {
  react: path.resolve(rootNodeModules, 'react'),
  'react/jsx-runtime': path.resolve(rootNodeModules, 'react/jsx-runtime'),
  'react/jsx-dev-runtime': path.resolve(rootNodeModules, 'react/jsx-dev-runtime'),
  'react-native': path.resolve(rootNodeModules, 'react-native'),
};

module.exports = config;
