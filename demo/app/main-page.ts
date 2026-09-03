import { Dialogs, EventData, Frame, Label, Page } from '@nativescript/core';
import { settings } from './settings.generated';

export function navigatingTo(args: EventData) {
  const page = <Page>args.object;

  // Preferences is an Observable that mirrors every key, so it can be the bindingContext.
  // One-way bindings update when the OS settings UI changes a value; two-way bindings write back.
  page.bindingContext = settings;

  const log = page.getViewById<Label>('lastChange');
  const unsubscribe = settings.onChange((change) => {
    log.text = `${change.key}: ${JSON.stringify(change.oldValue)} -> ${JSON.stringify(change.value)}`;
  });
  page.once(Page.unloadedEvent, unsubscribe);

  // Typed reads: the interface and defaults come from preferences.json via settings.generated.ts.
  const volume: number = settings.get('volume_preference');
  console.log(`Starting with volume ${volume} and theme ${settings.get('theme_preference')}`);
}

export async function onOpenSettings() {
  const opened = await settings.openSettings({ title: 'Demo settings' });
  if (!opened) {
    Dialogs.alert('The settings UI could not be opened.');
  }
}

export function onOpenEmbedded() {
  Frame.topmost().navigate('embedded-page');
}

export function onReset() {
  settings.clear();
}
