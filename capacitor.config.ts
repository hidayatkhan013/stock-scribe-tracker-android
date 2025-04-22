
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.4775eb3e5fe440799e367f745d70d84b',
  appName: 'stock-scribe-tracker-android',
  webDir: 'dist',
  server: {
    url: 'https://4775eb3e-5fe4-4079-9e36-7f745d70d84b.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  android: {
    buildOptions: {
      keystorePath: null,
      keystoreAlias: null,
      keystorePassword: null,
      keystoreAliasPassword: null,
    },
    // More comprehensive Android permissions for file access
    permissions: [
      "android.permission.READ_EXTERNAL_STORAGE",
      "android.permission.WRITE_EXTERNAL_STORAGE",
      "android.permission.MANAGE_EXTERNAL_STORAGE", // For Android 11+
      "android.permission.MANAGE_DOCUMENTS",
      "android.permission.READ_MEDIA_IMAGES", // For Android 13+
      "android.permission.READ_MEDIA_VIDEO",  // For Android 13+
      "android.permission.READ_MEDIA_AUDIO"   // For Android 13+
    ]
  },
  plugins: {
    // Configure filesystem plugin with more explicit permissions
    Filesystem: {
      androidPermissions: true
    }
  }
};

export default config;
