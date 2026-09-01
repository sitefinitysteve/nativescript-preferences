import { Preferences } from 'nativescript-preferences';

/**
 * One typed instance for the whole app. The keys match preferences.xml and Settings.bundle,
 * and the defaults mirror the ones declared there so values are usable before the user ever
 * opens the OS settings.
 */
export interface DemoSettings {
  name_preference: string;
  enabled_preference: boolean;
  theme_preference: 'system' | 'light' | 'dark';
  volume_preference: number;
  analytics_preference: boolean;
}

export const settings = new Preferences<DemoSettings>({
  defaults: {
    name_preference: '',
    enabled_preference: true,
    theme_preference: 'system',
    volume_preference: 50,
    analytics_preference: false,
  },
});
