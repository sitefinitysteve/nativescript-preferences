import { Trace } from '@nativescript/core';
import { OpenSettingsOptions, PreferenceValue, PreferencesCommon, PreferencesOptions, PreferencesViewBase, traceCategory } from './common';

export * from './common';

function fromNS(value: any): PreferenceValue | undefined {
	if (value === null || value === undefined) {
		return undefined;
	}
	switch (typeof value) {
		case 'string':
		case 'number':
		case 'boolean':
			return value;
	}
	if (value instanceof NSString) {
		return String(value);
	}
	if (value instanceof NSNumber) {
		return value.doubleValue;
	}
	if (value instanceof NSArray) {
		const result: string[] = [];
		for (let i = 0; i < value.count; i++) {
			result.push(String(value.objectAtIndex(i)));
		}
		return result;
	}
	return undefined;
}

function toNS(value: PreferenceValue): any {
	if (Array.isArray(value)) {
		const array = NSMutableArray.new<string>();
		for (const item of value) {
			array.addObject(String(item));
		}
		return array;
	}
	return value;
}

function mergeDictionary(target: Record<string, PreferenceValue>, dictionary: NSDictionary<string, any> | null): void {
	if (!dictionary) {
		return;
	}
	const keys = dictionary.allKeys;
	for (let i = 0; i < keys.count; i++) {
		const key = String(keys.objectAtIndex(i));
		const value = fromNS(dictionary.objectForKey(key));
		if (value !== undefined) {
			target[key] = value;
		}
	}
}

/** Collects `Key` → `DefaultValue` pairs from `<bundle>.bundle/Root.plist` and any child panes. */
function readSettingsBundleDefaults(bundleName: string): Record<string, PreferenceValue> {
	const result: Record<string, PreferenceValue> = {};
	const bundlePath = NSBundle.mainBundle.pathForResourceOfType(bundleName, 'bundle');
	if (!bundlePath) {
		Trace.write(`${bundleName}.bundle was not found in the app bundle, so no defaults were registered.`, traceCategory, Trace.messageType.info);
		return result;
	}
	const visited = new Set<string>();
	const visit = (plistName: string) => {
		if (visited.has(plistName)) {
			return;
		}
		visited.add(plistName);
		const dictionary = NSDictionary.dictionaryWithContentsOfFile(`${bundlePath}/${plistName}.plist`);
		const specifiers: NSArray<NSDictionary<string, any>> | null = dictionary ? dictionary.objectForKey('PreferenceSpecifiers') : null;
		if (!specifiers) {
			return;
		}
		for (let i = 0; i < specifiers.count; i++) {
			const specifier = specifiers.objectAtIndex(i);
			if (String(specifier.objectForKey('Type')) === 'PSChildPaneSpecifier') {
				const file = specifier.objectForKey('File');
				if (file) {
					visit(String(file));
				}
				continue;
			}
			const key = specifier.objectForKey('Key');
			const defaultValue = fromNS(specifier.objectForKey('DefaultValue'));
			if (key && defaultValue !== undefined) {
				result[String(key)] = defaultValue;
			}
		}
	};
	visit('Root');
	return result;
}

export class Preferences extends PreferencesCommon {
	private _defaults: NSUserDefaults;
	private _domain: string;
	private _observer: any = null;

	constructor(options?: PreferencesOptions) {
		super(options);
		this._defaults = this.suiteName ? NSUserDefaults.alloc().initWithSuiteName(this.suiteName) : NSUserDefaults.standardUserDefaults;
		this._domain = this.suiteName || NSBundle.mainBundle.bundleIdentifier;
		if (!this.suiteName) {
			this.registerDefaults();
		}
		this._init();
	}

	/** The underlying `NSUserDefaults`. */
	get ios(): NSUserDefaults {
		return this._defaults;
	}

	/**
	 * Registers the `DefaultValue` of every preference in `Settings.bundle` so reads fall back to
	 * them before the user opens Settings. Runs automatically for the shared store on every launch.
	 * Returns the defaults that were found.
	 */
	registerDefaults(bundleName = 'Settings'): Record<string, PreferenceValue> {
		const defaults = readSettingsBundleDefaults(bundleName);
		const keys = Object.keys(defaults);
		if (keys.length) {
			const dictionary = NSMutableDictionary.new<string, any>();
			for (const key of keys) {
				dictionary.setObjectForKey(toNS(defaults[key]), key);
			}
			this._defaults.registerDefaults(dictionary);
			this._sync();
		}
		return defaults;
	}

	openSettings(_options?: OpenSettingsOptions): Promise<boolean> {
		return new Promise((resolve) => {
			const url = NSURL.URLWithString(UIApplicationOpenSettingsURLString);
			const application = UIApplication.sharedApplication;
			if (!url || !application.canOpenURL(url)) {
				resolve(false);
				return;
			}
			application.openURLOptionsCompletionHandler(url, NSDictionary.new<string, any>(), (success: boolean) => resolve(!!success));
		});
	}

	protected _readAll(): Record<string, PreferenceValue> {
		const result: Record<string, PreferenceValue> = {};
		mergeDictionary(result, this._defaults.volatileDomainForName(NSRegistrationDomain));
		mergeDictionary(result, this._defaults.persistentDomainForName(this._domain));
		return result;
	}

	protected _read(key: string): PreferenceValue | undefined {
		return fromNS(this._defaults.objectForKey(key));
	}

	protected _write(key: string, value: PreferenceValue): void {
		if (typeof value === 'boolean') {
			this._defaults.setBoolForKey(value, key);
		} else if (typeof value === 'number') {
			if (Number.isInteger(value)) {
				this._defaults.setIntegerForKey(value, key);
			} else {
				this._defaults.setDoubleForKey(value, key);
			}
		} else {
			this._defaults.setObjectForKey(toNS(value), key);
		}
	}

	protected _remove(key: string): void {
		this._defaults.removeObjectForKey(key);
	}

	protected _clear(): void {
		this._defaults.removePersistentDomainForName(this._domain);
	}

	protected _startObserving(): void {
		if (this._observer) {
			return;
		}
		const owner = new WeakRef(this);
		this._observer = NSNotificationCenter.defaultCenter.addObserverForNameObjectQueueUsingBlock(NSUserDefaultsDidChangeNotification, null, NSOperationQueue.mainQueue, () => {
			const self = owner.get();
			if (self) {
				self._sync();
			}
		});
	}

	protected _stopObserving(): void {
		if (this._observer) {
			NSNotificationCenter.defaultCenter.removeObserver(this._observer);
			this._observer = null;
		}
	}
}

export class PreferencesView extends PreferencesViewBase {
	static readonly isSupported = false;

	declare nativeViewProtected: UIView;

	createNativeView(): UIView {
		Trace.write('PreferencesView renders nothing on iOS. App preferences live in the Settings app; call Preferences.shared.openSettings() to get there.', traceCategory, Trace.messageType.info);
		return UIView.new();
	}
}
