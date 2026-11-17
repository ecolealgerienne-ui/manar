// Public identifiers only (OAuth client IDs are not secrets). Real values come from mobile/.env (git-ignored) via EXPO_PUBLIC_*.
module.exports = {
  expo: {
    name: 'Music Room', slug: 'music-room', version: '1.0.0', orientation: 'portrait', scheme: 'musicroom',
    ios: { bundleIdentifier: 'com.musicroom.app' }, android: { package: 'com.musicroom.app' },
    web: { bundler: 'metro' },
    extra: {
      defaultApiUrl: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000',
    },
  },
};
