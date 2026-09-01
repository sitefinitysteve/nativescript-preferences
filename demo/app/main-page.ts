import { Dialogs, EventData, Frame, Label, Page } from '@nativescript/core';
import { PreferenceChangeEventData, Preferences } from 'nativescript-preferences';

const prefs = Preferences.shared;

export function navigatingTo(args: EventData) {
  const page = <Page>args.object;

  // Preferences is an Observable that mirrors every stored key, so it can be the bindingContext.
  // One-way bindings update when the OS settings UI changes a value; two-way bindings write back.
  page.bindingContext = prefs;

  const log = page.getViewById<Label>('lastChange');
  const unsubscribe = prefs.onChange((data: PreferenceChangeEventData) => {
    log.text = `${data.key}: ${JSON.stringify(data.oldValue)} -> ${JSON.stringify(data.value)}`;
  });
  page.once(Page.unloadedEvent, unsubscribe);
}

export async function onOpenSettings() {
  const opened = await prefs.openSettings({ title: 'Demo settings' });
  if (!opened) {
    Dialogs.alert('The settings UI could not be opened.');
  }
}

export function onOpenEmbedded() {
  Frame.topmost().navigate('embedded-page');
}

export function onReset() {
  prefs.clear();
}
