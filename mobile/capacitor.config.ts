import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.myexchanges.app',
  appName: 'MyExchanges',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
}

export default config
