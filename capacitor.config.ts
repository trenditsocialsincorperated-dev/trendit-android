import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.trendit.app',
  appName: 'Trendit',
  webDir: 'www',
  server: {
    androidScheme: 'https'
  }
};

export default config;
