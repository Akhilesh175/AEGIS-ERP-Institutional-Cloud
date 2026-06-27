import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.aegiserp.app',
  appName: 'AEGIS ERP',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    allowNavigation: [
      '*.razorpay.com',
      '*.supabase.co',
      '*.googleapis.com',
      '*.firebaseapp.com'
    ]
  },
  plugins: {
    CapacitorHttp: {
      enabled: true
    }
  }
};

export default config;
