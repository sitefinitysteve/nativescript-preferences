import { EventData, Frame, Page } from '@nativescript/core';
import { PreferenceScreenEventData } from 'nativescript-preferences';
import { settings } from './settings.generated';

export function navigatingTo(args: EventData) {
  const page = <Page>args.object;
  page.bindingContext = settings;
}

export function goBack() {
  Frame.topmost().goBack();
}

export function onNavigateToScreen(args: PreferenceScreenEventData) {
  // Leave `args.handled` false to get the default behaviour: a new page rooted at the nested screen.
  console.log(`Opening nested preference screen "${args.key}" (${args.title})`);
}
