import { EventData, Frame, Page } from '@nativescript/core';
import { PreferenceScreenEventData, Preferences } from 'nativescript-preferences';

export function navigatingTo(args: EventData) {
  const page = <Page>args.object;
  page.bindingContext = Preferences.shared;
}

export function goBack() {
  Frame.topmost().goBack();
}

export function onNavigateToScreen(args: PreferenceScreenEventData) {
  // Leave `args.handled` false to get the default behaviour: a new page rooted at the nested screen.
  console.log(`Opening nested preference screen "${args.key}" (${args.title})`);
}
