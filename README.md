# nativescript-preferences

Native app preferences for NativeScript 9.

- Read and write the store the operating system uses for your app: `NSUserDefaults` on iOS, the default `SharedPreferences` on Android.
- Send users to the OS-provided settings UI instead of building your own: the app's page in the iOS Settings app, or an AndroidX `PreferenceScreen` rendered from `res/xml/preferences.xml`.
- Keep your own screens in sync with the same values through change events and NativeScript bindings, so a setting can live in the OS UI and in-app at the same time.
- Typed keys and in-code defaults, so `settings.get('volume')` is a `number` and never `undefined`.

<img src="https://raw.githubusercontent.com/sitefinitysteve/nativescript-preferences/master/images/ios-sample.gif" width="200" /> <img src="https://raw.githubusercontent.com/sitefinitysteve/nativescript-preferences/master/images/android-sample.gif" width="200" />

## Installation

```bash
ns plugin add nativescript-preferences
```

Requires `@nativescript/core` 9 or newer. No native code to build: Android pulls `androidx.preference:preference` through the plugin's `include.gradle`.

## Describe your settings

Both platforms describe preferences declaratively. Use the same keys on both so your code stays platform-agnostic.

**iOS**: add `App_Resources/iOS/Settings.bundle/Root.plist` ([Apple docs](https://developer.apple.com/library/archive/documentation/Cocoa/Conceptual/UserDefaults/Preferences/Preferences.html), [demo](demo/App_Resources/iOS/Settings.bundle/Root.plist)). Child panes (`PSChildPaneSpecifier`) are supported.

**Android**: add `App_Resources/Android/src/main/res/xml/preferences.xml` ([AndroidX Preference docs](https://developer.android.com/develop/ui/views/components/settings), [demo](demo/App_Resources/Android/src/main/res/xml/preferences.xml)). Use the AndroidX widgets (`SwitchPreferenceCompat`, `EditTextPreference`, `ListPreference`, `SeekBarPreference`, `MultiSelectListPreference`, nested `PreferenceScreen`).

## Usage

Declare the schema once, with the same keys as your plist and XML, and share the instance across the app.

```ts
// settings.ts
import { Preferences } from 'nativescript-preferences';

export interface Settings {
  name_preference: string;
  enabled_preference: boolean;
  theme_preference: 'system' | 'light' | 'dark';
  volume_preference: number;
}

export const settings = new Preferences<Settings>({
  defaults: { name_preference: '', enabled_preference: true, theme_preference: 'system', volume_preference: 50 },
});
```

```ts
import { settings } from './settings';

settings.get('volume_preference');            // number, falls back to the default
settings.get('theme_preference');             // 'system' | 'light' | 'dark'
settings.set('enabled_preference', false);    // typed: a string here is a compile error
settings.set('name_preference', null);        // removes the stored value, the default applies again
settings.clear();                             // removes everything, defaults still apply

// React to changes from anywhere, including the OS settings UI
const stop = settings.onChange('enabled_preference', (value) => console.log('enabled is now', value));
settings.onChange((change) => console.log(change.key, change.oldValue, '->', change.value));
stop();

// Open the OS settings UI
await settings.openSettings();
```

Prefer no schema? `Preferences.shared` is an untyped instance of the same store, and the coercing getters (`getString`, `getNumber`, `getBoolean`, `getStringArray`) work on both.

### Use it as a binding context

`Preferences` is an `Observable` that mirrors every key (stored or defaulted) as a property. Point a page at it and bind, two-way if you like. Values edited in the OS UI show up immediately, and values edited in-app are written straight to the native store.

```ts
export function navigatingTo(args: EventData) {
  (<Page>args.object).bindingContext = settings;
}
```

```xml
<Label text="{{ name_preference || '(not set)' }}" />
<Switch checked="{{ enabled_preference }}" />
<Slider value="{{ volume_preference }}" minValue="0" maxValue="100" />
```

A key that clashes with a member of the class (for example `set` or `keys`) is still readable through `get()`, but it is not mirrored as a property.

### Opening settings on Android

Android has no OS-hosted settings page, so `openSettings()` navigates the topmost `Frame` to a page that renders `res/xml/preferences.xml` with `PreferenceFragmentCompat`. Nested `PreferenceScreen` elements with an `android:key` open as further pages, and the hardware back button works as usual.

```ts
await settings.openSettings({
  title: 'Settings',        // ActionBar title
  resource: 'preferences',  // res/xml/<resource>.xml
  rootKey: 'advanced',      // open a nested PreferenceScreen directly
  modal: false,             // present modally instead of navigating
  frame: Frame.topmost(),   // which Frame to navigate
});
```

The generated page has the CSS class `ns-preferences-page`, and the preference view has `ns-preferences`, in case you want to style them.

### Embedding the Android preference screen

`PreferencesView` hosts the native preference screen inside any page, tab or modal, so you can wrap it in your own chrome.

```xml
<Page xmlns="http://schemas.nativescript.org/tns.xsd" xmlns:prefs="nativescript-preferences">
  <ActionBar title="Settings">
    <NavigationButton android.systemIcon="ic_menu_back" tap="goBack" />
  </ActionBar>
  <prefs:PreferencesView resource="preferences" navigateToScreen="onNavigateToScreen" />
</Page>
```

On iOS the view renders nothing and `PreferencesView.isSupported` is `false`. Handle `navigateToScreen` and set `args.handled = true` if you want to present nested screens yourself.

### Defaults

Three layers, from strongest to weakest:

1. A value the user stored (in-app or through the OS UI).
2. Native defaults: the `DefaultValue` entries of `Settings.bundle` are registered on every launch on iOS; on Android call `registerDefaults()` once to persist the `android:defaultValue` entries of `preferences.xml` (the preference screen also applies them when first shown).
3. In-code `defaults` passed to the constructor. They are mirrored as bindable properties and, on iOS, registered natively too.

### Separate stores

```ts
const group = new Preferences({ suiteName: 'group.com.example.app' }); // iOS App Group / Android SharedPreferences file
```

On iOS the suite must be an App Group your app is entitled to. On Android it is a `SharedPreferences` file name; pass the same name as `suiteName` on `PreferencesView` to edit it with a preference screen.

### Value types

| JavaScript | iOS | Android |
| --- | --- | --- |
| `string` | `NSString` | `String` |
| `boolean` | `Bool` | `boolean` |
| `number` | `Integer` when integral, `Double` otherwise | keeps an existing `int`, `long` or `float`; new keys use `int` when integral, `float` otherwise |
| `string[]` | `NSArray<NSString>` | `Set<String>` (`MultiSelectListPreference`) |

The coercing getters are forgiving: `getBoolean` understands `"true"`, `"1"`, `"yes"`, `"on"` and numbers, and `getNumber` parses numeric strings.

## API

### `Preferences<Schema>`

`Schema` is an interface whose properties are `string`, `number`, `boolean` or `string[]`. Omit it for untyped access.

| Member | Description |
| --- | --- |
| `static shared` | Untyped instance for the store behind the OS settings UI, created on first access. |
| `static changeEvent` | `"change"`, for `prefs.on(Preferences.changeEvent, handler)`. |
| `new Preferences(options?)` | `options.defaults` seeds typed fallbacks; `options.suiteName` selects a separate store. |
| `defaults` | The frozen in-code defaults. |
| `get(key, fallback?)` | Stored value, else `fallback`, else the default. Typed by the schema. |
| `getString / getNumber / getBoolean / getStringArray(key, fallback?)` | Coerced reads. |
| `set(key, value)` | Writes a value; `null` or `undefined` removes the key. |
| `remove(key)`, `clear()` | Remove one key or everything. Defaults stay in effect. |
| `has(key)`, `keys()`, `getAll()` | Inspect the store. `has` ignores in-code defaults. |
| `onChange(callback)`, `onChange(key, callback)` | Subscribe; returns an unsubscribe function. |
| `refresh()` | Re-read the native store and raise events for differences. |
| `registerDefaults(...)` | iOS: register `Settings.bundle` defaults. Android: persist `preferences.xml` defaults. |
| `openSettings(options?)` | Open the OS settings UI. Resolves with `true` once presented. |
| `ios` / `android` | The underlying `NSUserDefaults` / `SharedPreferences`. |
| `dispose()` | Stop observing native changes (only for short-lived instances). |

### `PreferencesView`

| Member | Description |
| --- | --- |
| `resource` | `res/xml/<resource>.xml`, default `preferences`. |
| `suiteName` | `SharedPreferences` file to edit. |
| `rootKey` | Nested `PreferenceScreen` key to use as the root. |
| `navigateToScreen` event | Raised with `{ key, title, handled }` when a nested screen is tapped. |
| `static isSupported` | `true` on Android, `false` on iOS. |

## Migrating from 1.x

Version 2 is a rewrite with a new API. The `Settings.bundle` and `preferences.xml` files you already have keep working, with one Android change noted below.

| 1.x | 2.x |
| --- | --- |
| `import { Preferences } from 'nativescript-preferences'; const prefs = new Preferences();` | `Preferences.shared`, or `new Preferences<Schema>({ defaults })` for typed keys. |
| `prefs.getValue(key)` returned `null` for unknown keys, `""` / `false` / `0` on Android depending on the stored type | `prefs.get(key, fallback?)` returns `undefined` for unknown keys, or use `getString` / `getNumber` / `getBoolean` for coerced reads. |
| `prefs.getValue(key, defaultValue)` | `prefs.get(key, defaultValue)`, or put the default in the constructor `defaults`. |
| `prefs.setValue(key, value)` | `prefs.set(key, value)`. Numbers no longer force `putInt` on Android; the existing Java type is kept. |
| `prefs.clear()` | Same, and defaults still apply afterwards. |
| `prefs.openSettings()` returned nothing and started a custom `Activity` | Returns `Promise<boolean>`; Android navigates a NativeScript page with your Frame and ActionBar styling. |
| Polling to detect changes | `prefs.onChange(...)` or bind directly to the instance. |
| `tns-core-modules` 6 | `@nativescript/core` 9. |

Android specifics:

- Remove the `com.sitefinitysteve.nativescriptsettings.NativescriptSettingsActivity` entry if you added one to `AndroidManifest.xml`; the plugin no longer ships an `.aar` or an `Activity`.
- Switch `preferences.xml` to AndroidX widgets: `SwitchPreference` becomes `SwitchPreferenceCompat`, and `SeekBarPreference` / `app:` attributes are available.

## Development

```bash
npm run build          # compile src/
npm run demo.install   # install the demo app, linked to src/
npm run demo.ios
npm run demo.android
```

## License

Apache License Version 2.0, January 2004
