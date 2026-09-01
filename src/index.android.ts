import { ActionBar, Application, Frame, NavigationButton, Page, Trace, Utils, View } from '@nativescript/core';
import { OpenSettingsOptions, PreferenceScreenEventData, PreferenceValue, PreferencesCommon, PreferencesOptions, PreferencesViewBase, resourceProperty, rootKeyProperty, suiteNameProperty, traceCategory } from './common';

export * from './common';

const DEFAULT_RESOURCE = 'preferences';
const FRAGMENT_TAG = 'nativescript-preferences';
const ARG_RESOURCE = 'nativescript-preferences:resource';
const ARG_SUITE_NAME = 'nativescript-preferences:suiteName';
const ARG_ROOT_KEY = 'nativescript-preferences:rootKey';

function appContext(): android.content.Context {
	return Utils.android.getApplicationContext();
}

/** Mirrors `androidx.preference.PreferenceManager.getDefaultSharedPreferencesName()`. */
function sharedPreferencesName(suiteName: string | undefined): string {
	return suiteName || `${appContext().getPackageName()}_preferences`;
}

function resolveXmlResource(context: android.content.Context, name: string): number {
	const id = context.getResources().getIdentifier(name, 'xml', context.getPackageName());
	if (!id) {
		throw new Error(`nativescript-preferences: resource "res/xml/${name}.xml" was not found. Add App_Resources/Android/src/main/res/xml/${name}.xml with a <PreferenceScreen>.`);
	}
	return id;
}

function fromJava(value: any): PreferenceValue | undefined {
	if (value === null || value === undefined) {
		return undefined;
	}
	switch (typeof value) {
		case 'string':
		case 'number':
		case 'boolean':
			return value;
	}
	if (value instanceof java.lang.Boolean) {
		return value.booleanValue();
	}
	if (value instanceof java.lang.Number) {
		return value.doubleValue();
	}
	if (value instanceof java.util.Set) {
		const result: string[] = [];
		const iterator = value.iterator();
		while (iterator.hasNext()) {
			result.push(String(iterator.next()));
		}
		return result;
	}
	return String(value);
}

export class Preferences extends PreferencesCommon {
	private _prefs: android.content.SharedPreferences;
	private _listener: android.content.SharedPreferences.OnSharedPreferenceChangeListener | null = null;

	constructor(options?: PreferencesOptions) {
		super(options);
		this._prefs = appContext().getSharedPreferences(sharedPreferencesName(this.suiteName), android.content.Context.MODE_PRIVATE);
		this._init();
	}

	/** The underlying `android.content.SharedPreferences`. */
	get android(): android.content.SharedPreferences {
		return this._prefs;
	}

	/**
	 * Writes the `android:defaultValue` of every preference in `res/xml/<resource>.xml` that has no
	 * stored value yet. Runs once per install unless `readAgain` is true.
	 */
	registerDefaults(resource = DEFAULT_RESOURCE, readAgain = false): void {
		const context = appContext();
		const resId = resolveXmlResource(context, resource);
		if (this.suiteName) {
			androidx.preference.PreferenceManager.setDefaultValues(context, this.suiteName, android.content.Context.MODE_PRIVATE, resId, readAgain);
		} else {
			androidx.preference.PreferenceManager.setDefaultValues(context, resId, readAgain);
		}
		this._sync();
	}

	openSettings(options: OpenSettingsOptions = {}): Promise<boolean> {
		try {
			const resource = options.resource || DEFAULT_RESOURCE;
			resolveXmlResource(appContext(), resource);
			const page = createSettingsPage({ resource, rootKey: options.rootKey, suiteName: this.suiteName, title: options.title });
			return Promise.resolve(presentPage(page, { modal: options.modal, frame: options.frame, animated: options.animated }));
		} catch (error) {
			return Promise.reject(error);
		}
	}

	protected _readAll(): Record<string, PreferenceValue> {
		const result: Record<string, PreferenceValue> = {};
		const iterator = this._prefs.getAll().entrySet().iterator();
		while (iterator.hasNext()) {
			const entry = iterator.next();
			const value = fromJava(entry.getValue());
			if (value !== undefined) {
				result[String(entry.getKey())] = value;
			}
		}
		return result;
	}

	protected _read(key: string): PreferenceValue | undefined {
		if (!this._prefs.contains(key)) {
			return undefined;
		}
		return fromJava(this._prefs.getAll().get(key));
	}

	protected _write(key: string, value: PreferenceValue): void {
		const editor = this._prefs.edit();
		if (typeof value === 'boolean') {
			editor.putBoolean(key, value);
		} else if (typeof value === 'string') {
			editor.putString(key, value);
		} else if (typeof value === 'number') {
			this._putNumber(editor, key, value);
		} else {
			const set = new java.util.HashSet<string>();
			for (const item of value) {
				set.add(String(item));
			}
			editor.putStringSet(key, set);
		}
		editor.apply();
	}

	/** Keeps the Java type a preference already has, so PreferenceScreen widgets keep reading it. */
	private _putNumber(editor: android.content.SharedPreferences.Editor, key: string, value: number): void {
		const existing = this._prefs.contains(key) ? this._prefs.getAll().get(key) : null;
		if (existing instanceof java.lang.Long) {
			editor.putLong(key, Math.trunc(value));
		} else if (existing instanceof java.lang.Float) {
			editor.putFloat(key, value);
		} else if (existing instanceof java.lang.Integer) {
			editor.putInt(key, Math.trunc(value));
		} else if (Number.isInteger(value) && value >= -2147483648 && value <= 2147483647) {
			editor.putInt(key, value);
		} else if (Number.isInteger(value)) {
			editor.putLong(key, value);
		} else {
			editor.putFloat(key, value);
		}
	}

	protected _remove(key: string): void {
		this._prefs.edit().remove(key).apply();
	}

	protected _clear(): void {
		this._prefs.edit().clear().apply();
	}

	protected _startObserving(): void {
		if (this._listener) {
			return;
		}
		const owner = new WeakRef(this);
		// SharedPreferences keeps listeners weakly, so the instance holds the strong reference.
		this._listener = new android.content.SharedPreferences.OnSharedPreferenceChangeListener({
			onSharedPreferenceChanged: (_prefs: android.content.SharedPreferences, key: string) => {
				const self = owner.get();
				if (self) {
					self._sync(key === null || key === undefined ? undefined : String(key));
				}
			},
		});
		this._prefs.registerOnSharedPreferenceChangeListener(this._listener);
	}

	protected _stopObserving(): void {
		if (this._listener) {
			this._prefs.unregisterOnSharedPreferenceChangeListener(this._listener);
			this._listener = null;
		}
	}
}

// Settings page --------------------------------------------------------------------------------

interface SettingsPageOptions {
	resource: string;
	rootKey?: string;
	suiteName?: string;
	title?: string;
}

interface PresentOptions {
	modal?: boolean;
	frame?: Frame;
	host?: View;
	animated?: boolean;
}

function createSettingsPage(options: SettingsPageOptions): Page {
	const page = new Page();
	page.className = 'ns-preferences-page';

	const actionBar = new ActionBar();
	actionBar.title = options.title || 'Settings';
	const navigationButton = new NavigationButton();
	navigationButton.icon = 'res://abc_ic_ab_back_material';
	navigationButton.text = 'Back';
	actionBar.navigationButton = navigationButton;
	page.actionBar = actionBar;

	const view = new PreferencesView();
	view.className = 'ns-preferences';
	view.resource = options.resource;
	view.suiteName = options.suiteName;
	view.rootKey = options.rootKey;
	page.content = view;

	return page;
}

function presentPage(page: Page, options: PresentOptions): boolean {
	const animated = options.animated !== false;
	const frame = options.frame || Frame.topmost();
	if (!options.modal && frame) {
		page.actionBar.navigationButton.on(NavigationButton.tapEvent, () => {
			const owner = page.frame || frame;
			if (owner.canGoBack()) {
				owner.goBack();
			}
		});
		frame.navigate({ create: () => page, animated });
		return true;
	}
	const host = options.host || frame || Application.getRootView();
	if (!host) {
		throw new Error('nativescript-preferences: there is no Frame or root view to present the settings page from.');
	}
	page.actionBar.navigationButton.on(NavigationButton.tapEvent, () => page.closeModal());
	host.showModal(page, { context: null, closeCallback: () => undefined, fullscreen: true, animated });
	return true;
}

function isInsideModal(view: View): boolean {
	let current: any = view;
	while (current) {
		if (current._dialogFragment) {
			return true;
		}
		current = current.parent;
	}
	return false;
}

// Fragment -------------------------------------------------------------------------------------

type PreferenceFragment = androidx.preference.PreferenceFragmentCompat & { _owner?: WeakRef<PreferencesView> };

let FragmentClass: { new (): PreferenceFragment } | undefined;

function ensureFragmentClass(): { new (): PreferenceFragment } {
	if (FragmentClass) {
		return FragmentClass;
	}
	if (typeof androidx.preference === 'undefined' || !androidx.preference.PreferenceFragmentCompat) {
		throw new Error('nativescript-preferences: androidx.preference is missing. Make sure the plugin include.gradle was applied and rebuild the app.');
	}
	FragmentClass = androidx.preference.PreferenceFragmentCompat.extend({
		onCreatePreferences(this: PreferenceFragment, _savedInstanceState: android.os.Bundle, rootKey: string): void {
			const args = this.getArguments();
			const resource = (args && args.getString(ARG_RESOURCE)) || DEFAULT_RESOURCE;
			const suiteName = args ? args.getString(ARG_SUITE_NAME) : null;
			const root = (args && args.getString(ARG_ROOT_KEY)) || rootKey || null;
			if (suiteName) {
				this.getPreferenceManager().setSharedPreferencesName(suiteName);
			}
			this.setPreferencesFromResource(resolveXmlResource(this.requireContext(), resource), root);
		},
		onNavigateToScreen(this: PreferenceFragment, screen: androidx.preference.PreferenceScreen): void {
			const key = screen.getKey();
			if (!key) {
				Trace.write('A nested PreferenceScreen needs an android:key to be opened.', traceCategory, Trace.messageType.warn);
				return;
			}
			const rawTitle = screen.getTitle();
			const title = rawTitle ? String(rawTitle) : undefined;
			const owner = this._owner ? this._owner.get() : undefined;
			if (owner) {
				owner._navigateToScreen(key, title);
				return;
			}
			const args = this.getArguments();
			const page = createSettingsPage({
				resource: (args && args.getString(ARG_RESOURCE)) || DEFAULT_RESOURCE,
				suiteName: (args && args.getString(ARG_SUITE_NAME)) || undefined,
				rootKey: key,
				title,
			});
			presentPage(page, {});
		},
	}) as { new (): PreferenceFragment };
	return FragmentClass;
}

export class PreferencesView extends PreferencesViewBase {
	static readonly isSupported = true;

	declare nativeViewProtected: android.widget.FrameLayout;

	private _fragment: PreferenceFragment | null = null;
	private _fragmentManager: androidx.fragment.app.FragmentManager | null = null;
	private _attachListener: android.view.View.OnAttachStateChangeListener | null = null;

	createNativeView(): android.widget.FrameLayout {
		const layout = new android.widget.FrameLayout(this._context);
		layout.setId(android.view.View.generateViewId());
		return layout;
	}

	initNativeView(): void {
		super.initNativeView();
		const owner = new WeakRef(this);
		// The fragment can only be placed once the layout sits inside the page's fragment view.
		this._attachListener = new android.view.View.OnAttachStateChangeListener({
			onViewAttachedToWindow: () => {
				const view = owner.get();
				if (view) {
					view._ensureFragment();
				}
			},
			onViewDetachedFromWindow: () => undefined,
		});
		this.nativeViewProtected.addOnAttachStateChangeListener(this._attachListener);
	}

	disposeNativeView(): void {
		this._removeFragment();
		if (this._attachListener) {
			this.nativeViewProtected.removeOnAttachStateChangeListener(this._attachListener);
			this._attachListener = null;
		}
		super.disposeNativeView();
	}

	[resourceProperty.setNative](_value: string): void {
		this._reload();
	}

	[suiteNameProperty.setNative](_value: string): void {
		this._reload();
	}

	[rootKeyProperty.setNative](_value: string): void {
		this._reload();
	}

	/** @internal */
	_navigateToScreen(key: string, title: string | undefined): void {
		const data: PreferenceScreenEventData = { eventName: PreferencesViewBase.navigateToScreenEvent, object: this, key, title, handled: false };
		this.notify(data);
		if (data.handled) {
			return;
		}
		const currentTitle = this.page && this.page.actionBar ? this.page.actionBar.title : undefined;
		const page = createSettingsPage({ resource: this.resource, suiteName: this.suiteName, rootKey: key, title: title || currentTitle });
		if (isInsideModal(this)) {
			presentPage(page, { modal: true, host: this });
		} else {
			presentPage(page, { frame: (this.page && this.page.frame) || undefined });
		}
	}

	private _reload(): void {
		if (this._fragment && this.nativeViewProtected && this.nativeViewProtected.isAttachedToWindow()) {
			this._removeFragment();
			this._ensureFragment();
		}
	}

	private _resolveFragmentManager(): androidx.fragment.app.FragmentManager | null {
		const nativeView = this.nativeViewProtected;
		if (!nativeView) {
			return null;
		}
		try {
			const host = androidx.fragment.app.FragmentManager.findFragment(nativeView);
			if (host) {
				return host.getChildFragmentManager();
			}
		} catch (error) {
			// The view is not hosted by a fragment; fall through to the activity's manager.
		}
		const rootManager = (this as any)._getRootFragmentManager ? (this as any)._getRootFragmentManager() : null;
		return rootManager || null;
	}

	private _ensureFragment(): void {
		const manager = this._resolveFragmentManager();
		if (!manager || manager.isDestroyed()) {
			return;
		}
		if (this._fragment && this._fragmentManager && !this._fragmentManager.isDestroyed() && this._fragmentManager.equals(manager)) {
			return;
		}
		this._removeFragment();

		const args = new android.os.Bundle();
		args.putString(ARG_RESOURCE, this.resource || DEFAULT_RESOURCE);
		if (this.suiteName) {
			args.putString(ARG_SUITE_NAME, this.suiteName);
		}
		if (this.rootKey) {
			args.putString(ARG_ROOT_KEY, this.rootKey);
		}

		const Fragment = ensureFragmentClass();
		const fragment = new Fragment();
		fragment.setArguments(args);
		fragment._owner = new WeakRef(this);

		manager.beginTransaction().replace(this.nativeViewProtected.getId(), fragment, FRAGMENT_TAG).commitAllowingStateLoss();
		this._fragment = fragment;
		this._fragmentManager = manager;
	}

	private _removeFragment(): void {
		const manager = this._fragmentManager;
		const fragment = this._fragment;
		this._fragment = null;
		this._fragmentManager = null;
		if (manager && fragment && !manager.isDestroyed()) {
			try {
				manager.beginTransaction().remove(fragment).commitAllowingStateLoss();
			} catch (error) {
				Trace.write(`Could not remove the preference fragment: ${error}`, traceCategory, Trace.messageType.warn);
			}
		}
	}
}
