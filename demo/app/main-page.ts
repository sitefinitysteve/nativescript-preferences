import { Dialogs, EventData, Frame, isIOS, Label, Page } from '@nativescript/core';
import settings from './app.preferences';

let unsubscribe: (() => void) | undefined;

export function navigatingTo(args: EventData) {
	const page = <Page>args.object;

	// Preferences is an Observable that mirrors every key, so it can be the bindingContext.
	// One-way bindings update when the settings screen changes a value; two-way bindings write back.
	page.bindingContext = settings;

	page.getViewById<Label>('platformHint').text = isIOS
		? 'On iOS this hands off to the Settings app, where the generated Settings.bundle is rendered.'
		: 'On Android this pushes a page rendering the generated preferences.xml.';

	// Subscribe once for the life of the page; unloaded also fires when the app is backgrounded,
	// so unsubscribing there would silence the log after the first trip to the Settings app.
	const log = page.getViewById<Label>('lastChange');
	unsubscribe?.();
	unsubscribe = settings.onChange((change) => {
		log.text = `${change.key}: ${JSON.stringify(change.oldValue)} → ${JSON.stringify(change.value)}`;
	});

	// Typed reads: the keys and value types are inferred from app.preferences.ts.
	const textSize: number = settings.get('text_size');
	console.log(`Starting at ${textSize}pt with the ${settings.get('theme')} theme`);
}

export async function onOpenSettings() {
	const opened = await settings.openSettings({ title: 'Settings' });
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
