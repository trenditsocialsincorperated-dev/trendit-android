/// <reference types="@capacitor-firebase/authentication" />

import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.trendit.app',
  appName: 'Trendit',
  webDir: 'www',
  plugins: {
    FirebaseAuthentication: {
      skipNativeAuth: true,
      providers: ['google.com', 'github.com', 'twitter.com']
    }
  }
};

export default config;
