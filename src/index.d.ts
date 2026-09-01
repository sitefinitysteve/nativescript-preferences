import { EventData, Frame, Observable, Property, View } from '@nativescript/core';

/** Every value type that can live in the native preference store on both platforms. */
export type PreferenceValue = string | number | boolean | string[];

export interface PreferenceChangeEventData extends EventData {
	object: Preferences;
	/** The key that changed. */
	key: string;
	/** The new value, or `undefined` when the key was removed. */
	value: PreferenceValue | undefined;
	/** The previous value, or `undefined` when the key did not exist. */
	oldValue: PreferenceValue | undefined;
}

export interface PreferencesOptions {
	/**
	 * Name of a separate preference store.
	 * iOS: an App Group suite name such as `group.com.example.app`.
	 * Android: a SharedPreferences file name.
	 * Leave empty for the store the OS settings UI reads and writes.
	 */
	suiteName?: string;
}

export interface OpenSettingsOptions {
	/** Android only. ActionBar title of the generated settings page. Defaults to "Settings". */
	title?: string;
	/** Android only. Name of the `res/xml/<resource>.xml` PreferenceScreen. Defaults to "preferences". */
	resource?: string;
	/** Android only. Key of a nested PreferenceScreen inside the resource to open directly. */
	rootKey?: string;
	/** Android only. Present the page modally instead of navigating the Frame. */
	modal?: boolean;
	/** Android only. Frame to navigate. Defaults to `Frame.topmost()`. */
	frame?: Frame;
	/** Android only. Animate the navigation. Defaults to true. */
	animated?: boolean;
}

export interface PreferenceScreenEventData extends EventData {
	object: PreferencesView;
	/** `android:key` of the nested PreferenceScreen that was tapped. */
	key: string;
	/** `android:title` of the nested PreferenceScreen, if any. */
	title: string | undefined;
	/** Set to true from a handler to suppress the built-in navigation. */
	handled: boolean;
}

/**
 * Typed access to the app's native preference store.
 *
 * iOS: `NSUserDefaults`, the store behind the app's page in the Settings app.
 * Android: the default `SharedPreferences`, the store `PreferenceScreen` widgets edit.
 *
 * The instance is an `Observable` whose keys are mirrored as plain properties, so it works as a
 * `bindingContext` with one-way and two-way bindings.
 */
export declare class Preferences extends Observable {
	/** Raised with a `PreferenceChangeEventData` whenever a key changes, from any source. */
	static readonly changeEvent: string;

	/** The store behind the OS settings UI, created on first access. */
	static readonly shared: Preferences;

	/** The store name passed to the constructor, if any. */
	readonly suiteName: string | undefined;

	/** iOS only. The underlying `NSUserDefaults`. */
	readonly ios: any /* NSUserDefaults */;

	/** Android only. The underlying `android.content.SharedPreferences`. */
	readonly android: any /* android.content.SharedPreferences */;

	/**
	 * Creates an instance bound to a store. Prefer `Preferences.shared` unless you need a
	 * separate App Group suite or SharedPreferences file.
	 */
	constructor(options?: PreferencesOptions);

	/** Returns the stored value with its native type, or `defaultValue` when the key is absent. */
	get(key: string, defaultValue?: PreferenceValue): any;

	/** Returns the value as a string. Numbers, booleans and arrays are converted. */
	getString(key: string, defaultValue?: string): string;

	/** Returns the value as a number. Numeric strings are parsed; booleans map to 1 and 0. */
	getNumber(key: string, defaultValue?: number): number;

	/** Returns the value as a boolean. Accepts "true"/"false", "1"/"0", "yes"/"no", "on"/"off" and numbers. */
	getBoolean(key: string, defaultValue?: boolean): boolean;

	/** Returns a string array value (Android `MultiSelectListPreference`, iOS array). */
	getStringArray(key: string, defaultValue?: string[]): string[];

	/** Whether a value (stored or registered as default) exists for the key. */
	has(key: string): boolean;

	/** All known keys. */
	keys(): string[];

	/** A snapshot of every key and value. */
	getAll(): Record<string, PreferenceValue>;

	/**
	 * Stores a value. `null` or `undefined` removes the key.
	 * Android keeps the Java type a key already has (int, long, float) so `PreferenceScreen`
	 * widgets keep reading it; new numeric keys are stored as int when integral, float otherwise.
	 */
	set(key: string, value: PreferenceValue | null | undefined): void;

	/** Removes a key. Registered defaults remain in effect. */
	remove(key: string): void;

	/** Removes every stored value. Registered defaults remain in effect. */
	clear(): void;

	/** Re-reads the native store and raises change events for anything that differs. */
	refresh(): void;

	/** Subscribes to every change. Returns a function that unsubscribes. */
	onChange(callback: (data: PreferenceChangeEventData) => void): () => void;

	/** Subscribes to changes of one key. Returns a function that unsubscribes. */
	onChange(key: string, callback: (value: PreferenceValue | undefined, data: PreferenceChangeEventData) => void): () => void;

	/**
	 * iOS: registers the `DefaultValue` of every preference in `<bundleName>.bundle` (default
	 * "Settings") so reads fall back to them before the user opens Settings. Runs automatically for
	 * `Preferences.shared` on every launch. Returns the defaults that were found.
	 *
	 * Android: writes the `android:defaultValue` of every preference in `res/xml/<resource>.xml`
	 * (default "preferences") that has no stored value yet. Runs once per install unless
	 * `readAgain` is true.
	 */
	registerDefaults(resourceOrBundleName?: string, readAgain?: boolean): Record<string, PreferenceValue> | void;

	/**
	 * Opens the OS settings UI for this app.
	 * iOS: launches the Settings app on the app's page.
	 * Android: navigates to a page that renders `res/xml/preferences.xml` with AndroidX Preference.
	 * Resolves with `true` once the UI has been presented.
	 */
	openSettings(options?: OpenSettingsOptions): Promise<boolean>;

	/** Stops listening to native changes. Only needed for short-lived instances. */
	dispose(): void;

	/** @deprecated Use `get()`. */
	getValue(key: string, defaultValue?: PreferenceValue): any;

	/** @deprecated Use `set()`. */
	setValue(key: string, value: PreferenceValue | null | undefined): void;
}

/**
 * A view that hosts the native Android preference screen so it can be embedded in any page,
 * tab or modal. It renders nothing on iOS, where app preferences live in the Settings app.
 *
 * ```xml
 * <Page xmlns:prefs="nativescript-preferences">
 *   <prefs:PreferencesView resource="preferences" />
 * </Page>
 * ```
 */
export declare class PreferencesView extends View {
	/** True on Android, false on iOS. */
	static readonly isSupported: boolean;

	/** Raised with a `PreferenceScreenEventData` when a nested PreferenceScreen is tapped. Android only. */
	static readonly navigateToScreenEvent: string;

	/** Name of the `res/xml/<resource>.xml` PreferenceScreen. Defaults to "preferences". */
	resource: string;

	/** SharedPreferences file to edit. Defaults to the app's default SharedPreferences. */
	suiteName: string;

	/** Key of a nested PreferenceScreen to show as the root. */
	rootKey: string;
}

export declare const resourceProperty: Property<PreferencesView, string>;
export declare const suiteNameProperty: Property<PreferencesView, string>;
export declare const rootKeyProperty: Property<PreferencesView, string>;

export declare function isPreferenceValue(value: unknown): value is PreferenceValue;
export declare function coerceString(value: PreferenceValue | undefined, fallback: string): string;
export declare function coerceNumber(value: PreferenceValue | undefined, fallback: number): number;
export declare function coerceBoolean(value: PreferenceValue | undefined, fallback: boolean): boolean;
export declare function coerceStringArray(value: PreferenceValue | undefined, fallback: string[]): string[];
