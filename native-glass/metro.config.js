// Metro configuration for Expo + bundling .pt model assets
const { getDefaultConfig } = require('expo/metro-config')

/** @type {import('metro-config').ConfigT} */
const config = getDefaultConfig(__dirname)

// Ensure .pt and .ptl files are treated as assets and bundled
config.resolver.assetExts = [...config.resolver.assetExts, 'pt', 'ptl']

module.exports = config
