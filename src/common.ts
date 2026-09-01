import { Application, EventData, Frame, Observable, Property, Trace, View } from '@nativescript/core';

/** Every value type that can live in the native preference store on both platforms. */
export type PreferenceValue = string | number | boolean | string[];

export interface PreferenceChangeEventData extends EventData {
	object: PreferencesCommon;
	key: string;
	value: PreferenceValue | undefined;
	oldValue: PreferenceValue | undefined;
}

export interface PreferencesOptions {
	/**
	 * Name of a separate preference store.
	 * iOS: an App Group suite name (`group.com.example.app`).
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
 * The instance is an `Observable` whose stored keys are mirrored as plain properties, so it can be
 * used directly as a `bindingContext` with two-way bindings.
 */
export abstract class PreferencesCommon extends Observable {
	/** Raised with a `PreferenceChangeEventData` whenever a key changes, from any source. */
	static readonly changeEvent = 'change';

	/** The store behind the OS settings UI, created on first access. */
	static get shared(): PreferencesCommon {
		const ctor = this as unknown as { new (): PreferencesCommon; _shared?: PreferencesCommon };
		if (!Object.prototype.hasOwnProperty.call(ctor, '_shared') || !ctor._shared) {
			ctor._shared = new ctor();
		}
		return ctor._shared;
	}

	readonly suiteName: string | undefined;

	private readonly _mirror = new Map<string, PreferenceValue>();
	private readonly _reservedWarned = new Set<string>();
	private _initialized = false;

	constructor(options?: PreferencesOptions) {
		super();
		this.suiteName = options?.suiteName || undefined;
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
		const all = this._readAll();
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

	/** Returns the stored value with its native type, or `defaultValue` when the key is absent. */
	get(key: string, defaultValue?: PreferenceValue): any {
		const value = this._read(key);
		return value === undefined ? defaultValue : value;
	}

	getString(key: string, defaultValue = ''): string {
		return coerceString(this._read(key), defaultValue);
	}

	getNumber(key: string, defaultValue = 0): number {
		return coerceNumber(this._read(key), defaultValue);
	}

	getBoolean(key: string, defaultValue = false): boolean {
		return coerceBoolean(this._read(key), defaultValue);
	}

	getStringArray(key: string, defaultValue: string[] = []): string[] {
		return coerceStringArray(this._read(key), defaultValue);
	}

	has(key: string): boolean {
		return this._read(key) !== undefined;
	}

	keys(): string[] {
		return Object.keys(this._readAll());
	}

	getAll(): Record<string, PreferenceValue> {
		return this._readAll();
	}

	// Writing -------------------------------------------------------------------------------

	/** Stores a value. `null` or `undefined` removes the key. */
	set(key: string, value: PreferenceValue | null | undefined): void {
		if (typeof key !== 'string' || key === '') {
			throw new TypeError('nativescript-preferences: a preference key must be a non-empty string.');
		}
		if (value === null || value === undefined) {
			this.remove(key);
			return;
		}
		if (!isPreferenceValue(value)) {
			throw new TypeError(`nativescript-preferences: unsupported value for "${key}". Use a string, finite number, boolean or string[].`);
		}
		this._write(key, value);
		this._sync(key);
	}

	remove(key: string): void {
		this._remove(key);
		this._sync(key);
	}

	/** Removes every stored value. Registered defaults remain in effect. */
	clear(): void {
		this._clear();
		this._sync();
	}

	/** Re-reads the native store and raises change events for anything that differs. */
	refresh(): void {
		this._sync();
	}

	// Events --------------------------------------------------------------------------------

	onChange(callback: (data: PreferenceChangeEventData) => void): () => void;
	onChange(key: string, callback: (value: PreferenceValue | undefined, data: PreferenceChangeEventData) => void): () => void;
	onChange(keyOrCallback: string | ((data: PreferenceChangeEventData) => void), maybeCallback?: (value: PreferenceValue | undefined, data: PreferenceChangeEventData) => void): () => void {
		const handler =
			typeof keyOrCallback === 'string'
				? (data: PreferenceChangeEventData) => {
						if (data.key === keyOrCallback) {
							maybeCallback(data.value, data);
						}
					}
				: keyOrCallback;
		this.on(PreferencesCommon.changeEvent, handler as (data: EventData) => void);
		return () => this.off(PreferencesCommon.changeEvent, handler as (data: EventData) => void);
	}

	// Legacy 1.x API ------------------------------------------------------------------------

	/** @deprecated Use `get()`. */
	getValue(key: string, defaultValue?: PreferenceValue): any {
		return this.get(key, defaultValue);
	}

	/** @deprecated Use `set()`. */
	setValue(key: string, value: PreferenceValue | null | undefined): void {
		this.set(key, value);
	}

	// Internals -----------------------------------------------------------------------------

	/** Reconciles the mirrored state with the native store and raises events for differences. */
	protected _sync(key?: string): void {
		if (!this._initialized) {
			return;
		}
		if (key !== undefined) {
			this._applyMirror(key, this._read(key), true);
			return;
		}
		const all = this._readAll();
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
			this.notify<PreferenceChangeEventData>({ eventName: PreferencesCommon.changeEvent, object: this, key, value, oldValue });
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
