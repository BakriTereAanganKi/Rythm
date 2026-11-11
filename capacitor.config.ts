import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tanish.rythm',
  appName: 'Rythm',
  webDir: 'dist',
  backgroundColor: '#000000',
  plugins: {
    // Edge-to-edge: the web app pads itself with env(safe-area-inset-*) (viewport-fit=cover).
    SystemBars: { insetsHandling: 'native', initialViewportFitValueHint: 'cover', style: 'DARK' },
  },
};

export default config;
