import { NativeScriptConfig } from '@nativescript/core';

export default {
  id: 'org.nativescript.preferencesdemo',
  appPath: 'app',
  appResourcesPath: 'App_Resources',
  bundler: 'vite',
  bundlerConfigPath: 'vite.config.mts',
  android: {
    v8Flags: '--expose_gc',
    markingMode: 'none',
  },
} as NativeScriptConfig;
