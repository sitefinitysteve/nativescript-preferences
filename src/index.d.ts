import { EventData, Frame, Observable, Property, View } from '@nativescript/core';

/** Every value type that can live in the native preference store on both platforms. */
export type PreferenceValue = string | number | boolean | string[];

/** Constraint for the generic parameter of `Preferences`: every property must be a `PreferenceValue`. */
export type PreferenceSchemaOf<T> = { [K in keyof T]: PreferenceValue };

/** The untyped schema: any key, any `PreferenceValue`. */
export type PreferenceSchema = Record<string, PreferenceValue>;

/** True for the untyped schema (`Record<string, ...>`), false for a concrete interface. */
export type IsUntypedSchema<T> = string extends keyof T ? true : false;

/**
 * The defaults a schema needs. A concrete interface must provide a default for every key, which
 * is what lets `get()` return `T[K]` instead of `T[K] | undefined`. The untyped schema takes any
 * subset.
 */
export type PreferenceDefaults<T> = IsUntypedSchema<T> extends true ? Partial<T> : T;

/** What `get(key)` returns: never `undefined` for a typed schema, because every key has a default. */
export type PreferenceGetResult<T, K extends keyof T> = IsUntypedSchema<T> extends true ? T[K] | undefined : T[K];

export interface PreferenceChangeEventData<T extends PreferenceSchemaOf<T> = PreferenceSchema> extends EventData {
	object: Preferences<T>;
	/** The key that changed. */
	key: keyof T & string;
	/** The new effective value: the stored value, else the default, else `undefined`. */
	value: PreferenceValue | undefined;
	/** The previous effective value. */
	oldValue: PreferenceValue | undefined;
}

export interface PreferencesOptions<T extends PreferenceSchemaOf<T> = PreferenceSchema> {
	/**
	 * Name of a separate preference store.
	 * iOS: an App Group suite name such as `group.com.example.app`.
	 * Android: a SharedPreferences file name.
	 * Leave empty for the store the OS settings UI reads and writes.
	 */
	suiteName?: string;
	/**
	 * Values to fall back to while a key has nothing stored. Required for every key of a typed
	 * schema, optional for the untyped one. They are also mirrored as bindable properties. On iOS
	 * they are registered in the `NSRegistrationDomain` as well.
	 */
	defaults?: PreferenceDefaults<T>;
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
 * Give it a schema and a default for every key, and reads are typed and never `undefined`:
 *
 * ```ts
 * interface Settings { name: string; enabled: boolean; volume: number }
 * export const settings = new Preferences<Settings>({ defaults: { name: '', enabled: true, volume: 50 } });
 * settings.get('volume'); // number
 * ```
 *
 * Or describe the settings in `preferences.json` and import the generated module instead.
 *
 * The instance is an `Observable` whose keys are mirrored as plain properties, so it works as a
 * `bindingContext` with one-way and two-way bindings.
 */
export declare class Preferences<T extends PreferenceSchemaOf<T> = PreferenceSchema> extends Observable {
	/** Raised with a `PreferenceChangeEventData` whenever a key changes, from any source. */
	static readonly changeEvent: string;

	/** Untyped instance for the store behind the OS settings UI, created on first access. */
	static readonly shared: Preferences;

	/** The store name passed to the constructor, if any. */
	readonly suiteName: string | undefined;

	/** The in-code defaults passed to the constructor. */
	readonly defaults: Readonly<PreferenceDefaults<T>>;

	/** iOS only. The underlying `NSUserDefaults`. */
	readonly ios: any /* NSUserDefaults */;

	/** Android only. The underlying `android.content.SharedPreferences`. */
	readonly android: any /* android.content.SharedPreferences */;

	constructor(options?: PreferencesOptions<T>);

	/**
	 * Returns the stored value with its native type, else `fallback`, else the in-code default.
	 * Only the untyped schema can yield `undefined`; a typed schema has a default for every key.
	 */
	get<K extends keyof T & string>(key: K): PreferenceGetResult<T, K>;
	get<K extends keyof T & string>(key: K, fallback: T[K]): T[K];

	/** Returns the value as a string. Numbers, booleans and arrays are converted. */
	getString(key: keyof T & string, fallback?: string): string;

	/** Returns the value as a number. Numeric strings are parsed; booleans map to 1 and 0. */
	getNumber(key: keyof T & string, fallback?: number): number;

	/** Returns the value as a boolean. Accepts "true"/"false", "1"/"0", "yes"/"no", "on"/"off" and numbers. */
	getBoolean(key: keyof T & string, fallback?: boolean): boolean;

	/** Returns a string array value (Android `MultiSelectListPreference`, iOS array). */
	getStringArray(key: keyof T & string, fallback?: string[]): string[];

	/** Whether a value is stored natively for the key. In-code defaults do not count. */
	has(key: keyof T & string): boolean;

	/** Every key that is stored natively or has an in-code default. */
	keys(): (keyof T & string)[];

	/** A snapshot of every effective value. */
	getAll(): PreferenceDefaults<T>;

	/**
	 * Stores a value. `null` or `undefined` removes the key.
	 * Android keeps the Java type a key already has (int, long, float) so `PreferenceScreen`
	 * widgets keep reading it; new numeric keys are stored as int when integral, float otherwise.
	 */
	set<K extends keyof T & string>(key: K, value: T[K] | null | undefined): void;

	/** Removes a stored value. The in-code default, if any, applies again. */
	remove(key: keyof T & string): void;

	/** Removes every stored value. Defaults remain in effect. */
	clear(): void;

	/** Re-reads the native store and raises change events for anything that differs. */
	refresh(): void;

	/** Subscribes to every change. Returns a function that unsubscribes. */
	onChange(callback: (data: PreferenceChangeEventData<T>) => void): () => void;

	/** Subscribes to changes of one key. Returns a function that unsubscribes. */
	onChange<K extends keyof T & string>(key: K, callback: (value: PreferenceGetResult<T, K>, data: PreferenceChangeEventData<T>) => void): () => void;

	/**
	 * iOS: registers the `DefaultValue` of every preference in `<bundleName>.bundle` (default
	 * "Settings") so reads fall back to them before the user opens Settings. Runs automatically
	 * on every launch for instances without a `suiteName`. Returns the defaults that were found.
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
