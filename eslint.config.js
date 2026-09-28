// Flat config (SDK 53+). Requires: eslint, eslint-config-expo, prettier,
// eslint-config-prettier, eslint-plugin-prettier — install before running.
const { defineConfig, globalIgnores } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const eslintPluginPrettierRecommended = require('eslint-plugin-prettier/recommended');

module.exports = defineConfig([
  globalIgnores(['dist/*', '.expo/*', 'node_modules/*']),
  expoConfig,
  eslintPluginPrettierRecommended,
]);
