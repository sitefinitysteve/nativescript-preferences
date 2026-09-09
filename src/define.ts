import type { PreferenceItem, PreferencesDefinition } from './definition';

/** Kept free of `@nativescript/core` so the generator's parity test can import it under Node. */

export type DefinedValue = string | number | boolean | string[];

export interface DefinedOptions {
	defaults: Record<string, DefinedValue>;
	integers: string[];
	definition: PreferencesDefinition;
}

/**
 * Derives the constructor options for a definition: one default per stored key, and the slider
 * keys that round on write. The fallback for an omitted default is the one the generator writes
 * into the native files, so the app and the OS screen agree.
 */
export function toPreferencesOptions(definition: PreferencesDefinition): DefinedOptions {
	const defaults: Record<string, DefinedValue> = {};
	const integers: string[] = [];

	walk(definition.items, defaults, integers);

	return { defaults, integers, definition };
}

function walk(items: readonly PreferenceItem[], defaults: Record<string, DefinedValue>, integers: string[]): void {
	for (const item of items) {
		switch (item.type) {
			case 'group':
			case 'screen':
				walk(item.items, defaults, integers);
				break;
			case 'text':
				defaults[item.key] = item.default ?? '';
				break;
			case 'toggle':
				defaults[item.key] = item.default ?? false;
				break;
			case 'list':
				if (item.default === undefined) {
					throw new TypeError(`nativescript-preferences: list "${item.key}" needs a default.`);
				}

				defaults[item.key] = item.default;
				break;
			case 'multilist':
				defaults[item.key] = item.default ? item.default.slice() : [];
				break;
			case 'slider':
				defaults[item.key] = item.default ?? item.min ?? 0;
				integers.push(item.key);
				break;
			case 'label':
				break;
		}
	}
}
