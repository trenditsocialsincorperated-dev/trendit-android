
/// <reference types="@capacitor-firebase/authentication" />

import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.trendit.app',
  appName: 'Trendit',
  webDir: 'dist',

  server: {
    androidScheme: 'https',
    cleartext: true
  },

  android: {
    allowMixedContent: true
  },

  plugins: {
    FirebaseAuthentication: {
      authDomain: 'trend-it-c7ea4.firebaseapp.com',
      skipNativeAuth: true,
      providers: [
        'google.com',
        'github.com',
        'twitter.com'
      ]
    }
  }
};

export default config;
