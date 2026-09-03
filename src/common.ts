import { Application, EventData, Frame, Observable, Property, Trace, View } from '@nativescript/core';

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
	object: PreferencesCommon<T>;
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
	 * iOS: an App Group suite name (`group.com.example.app`).
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
	object: PreferencesViewBase;
	/** `android:key` of the nested PreferenceScreen that was tapped. */
	key: string;
	/** `android:title` of the nested PreferenceScreen, if any. */
	title: string | undefined;
	/** Set to true from a handler to suppress the built-in navigation. */
	handled: boolean;
}

export const traceCategory = 'nativescript-preferences';

export function isPreferenceValue(value: unknown): value is PreferenceValue {
	switch (typeof value) {
		case 'string':
		case 'boolean':
			return true;
		case 'number':
			return Number.isFinite(value);
		default:
			return Array.isArray(value) && value.every((item) => typeof item === 'string');
	}
}

export function valuesEqual(a: PreferenceValue | undefined, b: PreferenceValue | undefined): boolean {
	if (Array.isArray(a) || Array.isArray(b)) {
		return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((item, index) => item === b[index]);
	}
	return a === b;
}

export function coerceString(value: PreferenceValue | undefined, fallback: string): string {
	if (value === undefined) {
		return fallback;
	}
	return Array.isArray(value) ? value.join(',') : String(value);
}

export function coerceNumber(value: PreferenceValue | undefined, fallback: number): number {
	switch (typeof value) {
		case 'number':
			return value;
		case 'boolean':
			return value ? 1 : 0;
		case 'string': {
			const trimmed = value.trim();
			const parsed = Number(trimmed);
			return trimmed !== '' && Number.isFinite(parsed) ? parsed : fallback;
		}
		default:
			return fallback;
	}
}

export function coerceBoolean(value: PreferenceValue | undefined, fallback: boolean): boolean {
	switch (typeof value) {
		case 'boolean':
			return value;
		case 'number':
			return value !== 0;
		case 'string': {
			const normalized = value.trim().toLowerCase();
			if (normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on') {
				return true;
			}
			if (normalized === 'false' || normalized === '0' || normalized === 'no' || normalized === 'off' || normalized === '') {
				return false;
			}
			return fallback;
		}
		default:
			return fallback;
	}
}

export function coerceStringArray(value: PreferenceValue | undefined, fallback: string[]): string[] {
	return Array.isArray(value) ? value.slice() : fallback;
}

/**
 * Shared implementation. Platform classes provide the native store and the settings UI.
 *
 * The instance is an `Observable` whose keys (stored or defaulted) are mirrored as plain
 * properties, so it can be used directly as a `bindingContext` with two-way bindings.
 */
export abstract class PreferencesCommon<T extends PreferenceSchemaOf<T> = PreferenceSchema> extends Observable {
	/** Raised with a `PreferenceChangeEventData` whenever a key changes, from any source. */
	static readonly changeEvent = 'change';

	/** Untyped instance for the store behind the OS settings UI, created on first access. */
	static get shared(): PreferencesCommon {
		const ctor = this as unknown as { new (): PreferencesCommon; _shared?: PreferencesCommon };
		if (!Object.prototype.hasOwnProperty.call(ctor, '_shared') || !ctor._shared) {
			ctor._shared = new ctor();
		}
		return ctor._shared;
	}

	/** The store name passed to the constructor, if any. */
	readonly suiteName: string | undefined;

	/** The in-code defaults passed to the constructor. */
	readonly defaults: Readonly<PreferenceDefaults<T>>;

	private readonly _mirror = new Map<string, PreferenceValue>();
	private readonly _reservedWarned = new Set<string>();
	private _initialized = false;

	constructor(options?: PreferencesOptions<T>) {
		super();
		this.suiteName = options?.suiteName || undefined;
		const defaults: PreferenceSchema = {};
		for (const key of Object.keys(options?.defaults || {})) {
			const value = (options.defaults as PreferenceSchema)[key];
			if (!isPreferenceValue(value)) {
				throw new TypeError(`nativescript-preferences: unsupported default for "${key}". Use a string, finite number, boolean or string[].`);
			}
			defaults[key] = value;
		}
		this.defaults = Object.freeze(defaults) as Readonly<PreferenceDefaults<T>>;
	}

	// Platform contract ---------------------------------------------------------------------

	protected abstract _readAll(): Record<string, PreferenceValue>;
	protected abstract _read(key: string): PreferenceValue | undefined;
	protected abstract _write(key: string, value: PreferenceValue): void;
	protected abstract _remove(key: string): void;
	protected abstract _clear(): void;
	protected abstract _startObserving(): void;
	protected abstract _stopObserving(): void;

	/** Opens the OS settings UI for this app. Resolves with `true` once it has been presented. */
	abstract openSettings(options?: OpenSettingsOptions): Promise<boolean>;

	/** Platform constructors call this once their native store is ready. */
	protected _init(): void {
		if (this._initialized) {
			return;
		}
		this._initialized = true;
		const all = this._effectiveAll();
		for (const key of Object.keys(all)) {
			this._applyMirror(key, all[key], false);
		}
		this._startObserving();
		Application.on(Application.resumeEvent, this._onAppResume, this);
	}

	/** Stops listening to native changes. Only needed for short-lived instances. */
	dispose(): void {
		this._stopObserving();
		Application.off(Application.resumeEvent, this._onAppResume, this);
	}

	// Reading -------------------------------------------------------------------------------

	/**
	 * Returns the stored value with its native type, else `fallback`, else the in-code default,
	 * else `undefined`.
	 */
	get<K extends keyof T & string>(key: K): PreferenceGetResult<T, K>;
	get<K extends keyof T & string>(key: K, fallback: T[K]): T[K];
	get(key: string, fallback?: PreferenceValue): PreferenceValue | undefined {
		const value = this._read(key);
		if (value !== undefined) {
			return value;
		}
		return fallback !== undefined ? fallback : (this.defaults as PreferenceSchema)[key];
	}

	getString(key: keyof T & string, fallback = ''): string {
		return coerceString(this.get(key), fallback);
	}

	getNumber(key: keyof T & string, fallback = 0): number {
		return coerceNumber(this.get(key), fallback);
	}

	getBoolean(key: keyof T & string, fallback = false): boolean {
		return coerceBoolean(this.get(key), fallback);
	}

	getStringArray(key: keyof T & string, fallback: string[] = []): string[] {
		return coerceStringArray(this.get(key), fallback);
	}

	/** Whether a value is stored natively for the key. In-code defaults do not count. */
	has(key: keyof T & string): boolean {
		return this._read(key) !== undefined;
	}

	/** Every key that is stored natively or has an in-code default. */
	keys(): (keyof T & string)[] {
		return Object.keys(this._effectiveAll()) as (keyof T & string)[];
	}

	/** A snapshot of every effective value. */
	getAll(): PreferenceDefaults<T> {
		return this._effectiveAll() as PreferenceDefaults<T>;
	}

	// Writing -------------------------------------------------------------------------------

	/** Stores a value. `null` or `undefined` removes the key. */
	set<K extends keyof T & string>(key: K, value: T[K] | null | undefined): void;
	set(key: string, value: PreferenceValue | null | undefined): void {
		if (typeof key !== 'string' || key === '') {
			throw new TypeError('nativescript-preferences: a preference key must be a non-empty string.');
		}
		if (value === null || value === undefined) {
			this.remove(key as keyof T & string);
			return;
		}
		if (!isPreferenceValue(value)) {
			throw new TypeError(`nativescript-preferences: unsupported value for "${key}". Use a string, finite number, boolean or string[].`);
		}
		this._write(key, value);
		this._sync(key);
	}

	/** Removes a stored value. The in-code default, if any, applies again. */
	remove(key: keyof T & string): void {
		this._remove(key);
		this._sync(key);
	}

	/** Removes every stored value. Defaults remain in effect. */
	clear(): void {
		this._clear();
		this._sync();
	}

	/** Re-reads the native store and raises change events for anything that differs. */
	refresh(): void {
		this._sync();
	}

	// Events --------------------------------------------------------------------------------

	onChange(callback: (data: PreferenceChangeEventData<T>) => void): () => void;
	onChange<K extends keyof T & string>(key: K, callback: (value: PreferenceGetResult<T, K>, data: PreferenceChangeEventData<T>) => void): () => void;
	onChange(keyOrCallback: string | ((data: PreferenceChangeEventData<T>) => void), maybeCallback?: (value: any, data: PreferenceChangeEventData<T>) => void): () => void {
		const handler =
			typeof keyOrCallback === 'string'
				? (data: PreferenceChangeEventData<T>) => {
						if (data.key === keyOrCallback) {
							maybeCallback(data.value, data);
						}
					}
				: keyOrCallback;
		this.on(PreferencesCommon.changeEvent, handler as (data: EventData) => void);
		return () => this.off(PreferencesCommon.changeEvent, handler as (data: EventData) => void);
	}

	// Internals -----------------------------------------------------------------------------

	private _effective(key: string): PreferenceValue | undefined {
		const value = this._read(key);
		return value !== undefined ? value : (this.defaults as PreferenceSchema)[key];
	}

	private _effectiveAll(): Record<string, PreferenceValue> {
		return { ...(this.defaults as PreferenceSchema), ...this._readAll() };
	}

	/** Reconciles the mirrored state with the native store and raises events for differences. */
	protected _sync(key?: string): void {
		if (!this._initialized) {
			return;
		}
		if (key !== undefined) {
			this._applyMirror(key, this._effective(key), true);
			return;
		}
		const all = this._effectiveAll();
		for (const k of Object.keys(all)) {
			this._applyMirror(k, all[k], true);
		}
		for (const k of Array.from(this._mirror.keys())) {
			if (!Object.prototype.hasOwnProperty.call(all, k)) {
				this._applyMirror(k, undefined, true);
			}
		}
	}

	private _applyMirror(key: string, value: PreferenceValue | undefined, notify: boolean): void {
		const oldValue = this._mirror.get(key);
		if (notify && valuesEqual(oldValue, value)) {
			return;
		}
		const mirrored = this._mirror.has(key);
		const reserved = !mirrored && key in this;
		if (reserved && !this._reservedWarned.has(key)) {
			this._reservedWarned.add(key);
			Trace.write(`Preference key "${key}" clashes with a member of Preferences and will not be exposed as a bindable property. Use get("${key}") instead.`, traceCategory, Trace.messageType.warn);
		}
		if (value === undefined) {
			this._mirror.delete(key);
			if (mirrored && !reserved) {
				delete (this as any)[key];
			}
		} else {
			this._mirror.set(key, value);
			if (!reserved) {
				(this as any)[key] = value;
			}
		}
		if (notify) {
			this.notifyPropertyChange(key, value, oldValue);
			this.notify<PreferenceChangeEventData<T>>({ eventName: PreferencesCommon.changeEvent, object: this, key: key as keyof T & string, value, oldValue });
		}
	}

	private _onAppResume(): void {
		this._sync();
	}
}

/**
 * Hosts the native preference screen inside a NativeScript view tree.
 * Android renders `res/xml/<resource>.xml` with AndroidX Preference. iOS renders nothing, because
 * iOS keeps app preferences in the system Settings app.
 */
export abstract class PreferencesViewBase extends View {
	/** Raised when a nested PreferenceScreen is tapped. Android only. */
	static readonly navigateToScreenEvent = 'navigateToScreen';

	/** Name of the `res/xml/<resource>.xml` PreferenceScreen. Defaults to "preferences". */
	declare resource: string;
	/** SharedPreferences file to edit. Defaults to the app's default SharedPreferences. */
	declare suiteName: string;
	/** Key of a nested PreferenceScreen to show as the root. */
	declare rootKey: string;
}

export const resourceProperty = new Property<PreferencesViewBase, string>({ name: 'resource', defaultValue: 'preferences' });
export const suiteNameProperty = new Property<PreferencesViewBase, string>({ name: 'suiteName' });
export const rootKeyProperty = new Property<PreferencesViewBase, string>({ name: 'rootKey' });

resourceProperty.register(PreferencesViewBase);
suiteNameProperty.register(PreferencesViewBase);
rootKeyProperty.register(PreferencesViewBase);
