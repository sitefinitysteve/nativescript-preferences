# nativescript-preferences

Native app preferences for NativeScript 9.

- Read and write the store the operating system uses for your app: `NSUserDefaults` on iOS, the default `SharedPreferences` on Android.
- Send users to the OS-provided settings UI instead of building your own: the app's page in the iOS Settings app, or an AndroidX `PreferenceScreen` rendered from `res/xml/preferences.xml`.
- Keep your own screens in sync with the same values through change events and NativeScript bindings, so a setting can live in the OS UI and in-app at the same time.

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

```ts
import { Preferences } from 'nativescript-preferences';

const prefs = Preferences.shared;

// Typed reads with defaults
prefs.getString('name_preference', 'Anonymous');
prefs.getBoolean('enabled_preference', true);
prefs.getNumber('volume_preference', 50);
prefs.getStringArray('topics_preference', []);
prefs.get('theme_preference'); // raw value with its native type

// Writes
prefs.set('name_preference', 'Steve');
prefs.set('enabled_preference', false);
prefs.set('name_preference', null); // removes the key
prefs.clear(); // removes everything; registered defaults still apply

// React to changes from anywhere, including the OS settings UI
const stop = prefs.onChange('enabled_preference', (value) => console.log('enabled is now', value));
prefs.onChange((change) => console.log(change.key, change.oldValue, '->', change.value));
stop();

// Open the OS settings UI
await prefs.openSettings();
```

### Use it as a binding context

`Preferences` is an `Observable` that mirrors every stored key as a property. Point a page at it and bind, two-way if you like. Values edited in the OS UI show up immediately, and values edited in-app are written straight to the native store.

```ts
export function navigatingTo(args: EventData) {
  (<Page>args.object).bindingContext = Preferences.shared;
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
await prefs.openSettings({
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

- iOS: the `DefaultValue` of every entry in `Settings.bundle` is registered on every launch for `Preferences.shared`, so reads work before the user ever opens Settings. Call `registerDefaults('OtherBundle')` for a different bundle.
- Android: call `prefs.registerDefaults()` once (for example at startup) to persist the `android:defaultValue` entries of `preferences.xml`. The preference screen also applies them when it is first shown.

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

The typed getters coerce: `getBoolean` understands `"true"`, `"1"`, `"yes"`, `"on"` and numbers, and `getNumber` parses numeric strings.

## API

### `Preferences`

| Member | Description |
| --- | --- |
| `static shared` | Instance for the store behind the OS settings UI, created on first access. |
| `static changeEvent` | `"change"`, for `prefs.on(Preferences.changeEvent, handler)`. |
| `new Preferences(options?)` | `options.suiteName` selects a separate store. |
| `get(key, default?)` | Raw value with its native type. |
| `getString / getNumber / getBoolean / getStringArray(key, default?)` | Coerced reads. |
| `set(key, value)` | Writes a value; `null` or `undefined` removes the key. |
| `remove(key)`, `clear()` | Remove one key or everything. |
| `has(key)`, `keys()`, `getAll()` | Inspect the store. |
| `onChange(callback)`, `onChange(key, callback)` | Subscribe; returns an unsubscribe function. |
| `refresh()` | Re-read the native store and raise events for differences. |
| `registerDefaults(...)` | iOS: register `Settings.bundle` defaults. Android: persist `preferences.xml` defaults. |
| `openSettings(options?)` | Open the OS settings UI. Resolves with `true` once presented. |
| `ios` / `android` | The underlying `NSUserDefaults` / `SharedPreferences`. |
| `dispose()` | Stop observing native changes (only for short-lived instances). |
| `getValue` / `setValue` | Deprecated aliases from 1.x. |

### `PreferencesView`

| Member | Description |
| --- | --- |
| `resource` | `res/xml/<resource>.xml`, default `preferences`. |
| `suiteName` | `SharedPreferences` file to edit. |
| `rootKey` | Nested `PreferenceScreen` key to use as the root. |
| `navigateToScreen` event | Raised with `{ key, title, handled }` when a nested screen is tapped. |
| `static isSupported` | `true` on Android, `false` on iOS. |

## Migrating from 1.x

- `new Preferences()` still works, but prefer `Preferences.shared`.
- `getValue` / `setValue` still work and map to `get` / `set`.
- Android no longer ships a prebuilt `.aar` or its own `Activity`. Delete any manifest entries you added for `com.sitefinitysteve.nativescriptsettings` and switch `preferences.xml` to AndroidX widgets (`SwitchPreference` becomes `SwitchPreferenceCompat`).
- Android `openSettings()` now navigates a NativeScript page, so it returns a `Promise` and respects your Frame and ActionBar styling.

## Development

```bash
npm run build          # compile src/
npm run demo.install   # install the demo app, linked to src/
npm run demo.ios
npm run demo.android
```

## License

Apache License Version 2.0, January 2004
