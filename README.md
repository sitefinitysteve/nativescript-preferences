# nativescript-preferences

Native app preferences for NativeScript 9, with one typed API for both platforms.

- Read and write the store the operating system already keeps for your app: `NSUserDefaults` on iOS, the default `SharedPreferences` on Android.
- Declare your settings once in TypeScript. Keys and defaults live in code, and `settings.get('volume')` is a `number`.
- Bind your own screens straight to the store. The instance is an `Observable`, so `{{ volume }}` in XML just works, two-way included.
- Get change events from any source, including the OS settings UI.
- Optionally hand the UI to the OS: the app's page in the iOS Settings app, or an AndroidX `PreferenceScreen` on Android. Describe it once in `preferences.json` and the plist, the XML and the TypeScript schema are generated on every build.

<img src="https://raw.githubusercontent.com/sitefinitysteve/nativescript-preferences/master/images/ios-sample.gif" width="200" /> <img src="https://raw.githubusercontent.com/sitefinitysteve/nativescript-preferences/master/images/android-sample.gif" width="200" />

## Installation

```bash
ns plugin add nativescript-preferences
```

Requires `@nativescript/core` 9 or newer. There is no native code to build and nothing to add to `Info.plist` or `AndroidManifest.xml`. Android pulls `androidx.preference:preference` through the plugin's `include.gradle`.

## Quick start

Everything below is platform-agnostic. No plist, no XML, no `if (isIOS)`.

**1. Declare your settings once.** One file, one instance, shared across the app.

```ts
// settings.ts
import { Preferences } from 'nativescript-preferences';

export interface Settings {
  name: string;
  enabled: boolean;
  theme: 'system' | 'light' | 'dark';
  volume: number;
}

export const settings = new Preferences<Settings>({
  defaults: { name: '', enabled: true, theme: 'system', volume: 50 },
});
```

**2. Read and write.** Values are stored natively and survive restarts.

```ts
import { settings } from './settings';

settings.get('volume');           // 50 until something is stored, then the stored number
settings.get('theme');            // 'system' | 'light' | 'dark'
settings.set('enabled', false);   // typed: a string here is a compile error
settings.set('name', null);       // removes the stored value, the default applies again
settings.clear();                 // removes everything, defaults still apply
```

**3. Bind a page to it.** The instance is an `Observable` that mirrors every key as a property.

```ts
export function navigatingTo(args: EventData) {
  (<Page>args.object).bindingContext = settings;
}
```

```xml
<TextField text="{{ name }}" hint="Name" />
<Switch checked="{{ enabled }}" />
<Slider value="{{ volume }}" minValue="0" maxValue="100" />
```

Two-way bindings write straight to the native store. Anything else that changes the store, including the OS settings UI, updates the bindings.

**4. React to changes.**

```ts
const stop = settings.onChange('enabled', (value) => console.log('enabled is now', value));
settings.onChange((change) => console.log(change.key, change.oldValue, '->', change.value));
stop();
```

That is the whole plugin for most apps. Keep reading if you want the operating system to render the settings screen for you, without writing platform files by hand.

### Notes on typing

- `get(key)` is typed `T[K] | undefined`. The runtime falls back to the in-code default, but the compiler cannot see which keys have one. Pass a fallback (`get('volume', 50)`) or use `getNumber` / `getString` / `getBoolean` / `getStringArray` when you need a non-optional type under `strictNullChecks`.
- Schema properties must be `string`, `number`, `boolean` or `string[]`. Those are the types both native stores share.
- Prefer no schema? `Preferences.shared` is an untyped instance of the same store, and the coercing getters work on it too.

## Optional: let the OS render the settings screen

You never have to build a settings UI. Both operating systems can render one from a declarative file, and `openSettings()` takes the user there:

```ts
await settings.openSettings();
```

Each OS wants its own file: iOS reads a `Settings.bundle` compiled into the app, Android inflates a `res/xml` resource. Instead of writing both by hand, describe the settings once in `preferences.json` and let the plugin generate the plist, the XML and the TypeScript schema from it on every build.

### 1. Describe the settings once

```bash
npx ns-preferences init
```

This creates a starter `preferences.json` in the project root. The `$schema` line gives you autocompletion and validation in VS Code and other editors.

```json
{
  "$schema": "node_modules/nativescript-preferences/preferences.schema.json",
  "output": { "typescript": "app/settings.generated.ts" },
  "items": [
    {
      "type": "group",
      "title": "General",
      "items": [
        { "key": "name", "type": "text", "title": "Name", "default": "" },
        { "key": "enabled", "type": "toggle", "title": "Enabled", "summary": "Turns the thing on", "default": true },
        {
          "key": "theme", "type": "list", "title": "Theme", "default": "system",
          "options": [{ "value": "system", "title": "Follow system" }, "light", "dark"]
        },
        { "key": "volume", "type": "slider", "title": "Volume", "default": 50, "min": 0, "max": 100 }
      ]
    },
    {
      "type": "screen", "key": "advanced", "title": "Advanced",
      "items": [{ "key": "analytics", "type": "toggle", "title": "Share anonymous analytics", "default": false }]
    }
  ]
}
```

### 2. Generate on every build

Add the hook to `nativescript.config.ts`:

```ts
export default {
  // ...
  hooks: [{ type: 'before-prepare', script: 'node_modules/nativescript-preferences/hooks/before-prepare.cjs' }],
} as NativeScriptConfig;
```

Every `ns run`, `ns build` and `ns prepare` now regenerates, for the platform being built:

| Output | Path |
| --- | --- |
| iOS Settings.bundle, one plist per screen | `App_Resources/iOS/Settings.bundle/Root.plist`, `<screenKey>.plist` |
| AndroidX preference screen | `App_Resources/Android/src/main/res/xml/preferences.xml` |
| Android string arrays for lists | `App_Resources/Android/src/main/res/values/preferences_arrays.xml` |
| Typed schema, defaults and a shared instance | `output.typescript`, when set |

Files are only rewritten when their content changes, so the hook does not trigger needless native rebuilds. Generated files carry a "Do not edit" header. Commit them, or add them to `.gitignore`; both work because the hook regenerates before every build.

You can also run it by hand, for example while `ns run` is watching, or in CI to fail when someone edited a generated file:

```bash
npx ns-preferences generate   # write everything now
npx ns-preferences check      # exit 1 if any generated file is out of date
```

### 3. Use the generated module

With `output.typescript` set you do not write the `Settings` interface from the quick start yourself:

```ts
import { settings } from './settings.generated';

settings.get('theme');   // 'system' | 'light' | 'dark', from the list options
settings.set('volume', 80);
await settings.openSettings();
```

The module exports the interface (`AppSettings`), the defaults (`settingsDefaults`) and a ready `Preferences` instance (`settings`). Rename them with `output.interfaceName` and `output.exportName`.

### Item types

Every item except `group` has a `key`, which is the storage key and must be unique. `title` and `summary` are optional everywhere; iOS shows a `summary` only on groups (as footer text).

| `type` | Stores | iOS | Android | Extra fields |
| --- | --- | --- | --- | --- |
| `group` | nothing | `PSGroupSpecifier` | `PreferenceCategory` | `items` (no nested groups) |
| `screen` | nothing | `PSChildPaneSpecifier` + own plist | nested `PreferenceScreen` | `items` |
| `text` | `string` | `PSTextFieldSpecifier` | `EditTextPreference` | `default`, `secure`, `keyboard`, `autocapitalize`, `autocorrect` (the last four are iOS only) |
| `toggle` | `boolean` | `PSToggleSwitchSpecifier` | `SwitchPreferenceCompat` | `default` |
| `list` | one option value | `PSMultiValueSpecifier` | `ListPreference` | `options`, `default` |
| `multilist` | `string[]` | not rendered (iOS has no control for it) | `MultiSelectListPreference` | `options`, `default` |
| `slider` | integer `number` | `PSSliderSpecifier` (no title on iOS) | `SeekBarPreference` | `default`, `min`, `max`, `step` |
| `label` | nothing | `PSTitleValueSpecifier` | non-selectable `Preference` | `value` |

`options` entries are either plain strings or `{ "value", "title" }`. Defaults are validated against the options, sliders against `min` and `max`.

### Writing the platform files by hand

The generator is optional. Hand-written files keep working as before, and you can mix: skip the hook and write `preferences.xml` yourself, or ship only the iOS bundle and build your own Android screen with bindings.

| | File | Docs | Example |
| --- | --- | --- | --- |
| iOS | `App_Resources/iOS/Settings.bundle/Root.plist` | [Apple](https://developer.apple.com/library/archive/documentation/Cocoa/Conceptual/UserDefaults/Preferences/Preferences.html) | [demo](demo/App_Resources/iOS/Settings.bundle/Root.plist) |
| Android | `App_Resources/Android/src/main/res/xml/preferences.xml` | [AndroidX Preference](https://developer.android.com/develop/ui/views/components/settings) | [demo](demo/App_Resources/Android/src/main/res/xml/preferences.xml) |

Use the same keys as your schema. Without the file, `openSettings()` still opens your app's entry in the iOS Settings app (it then lists only system permissions), and rejects with a clear error on Android.

**iOS**: `PSChildPaneSpecifier` child panes are supported. The `DefaultValue` entries are registered on every launch so reads fall back to them.

**Android**: use the AndroidX widgets (`SwitchPreferenceCompat`, `EditTextPreference`, `ListPreference`, `SeekBarPreference`, `MultiSelectListPreference`, nested `PreferenceScreen`). Call `registerDefaults()` once to persist the `android:defaultValue` entries; the screen also applies them when first shown.

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

Every option is ignored on iOS, so one call works on both platforms. The generated page has the CSS class `ns-preferences-page`, and the preference view has `ns-preferences`, in case you want to style them.

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

## Details

### Defaults

Three layers, from strongest to weakest:

1. A value the user stored (in-app or through the OS UI).
2. Native defaults: the `DefaultValue` entries of `Settings.bundle` are registered on every launch on iOS; on Android call `registerDefaults()` once to persist the `android:defaultValue` entries of `preferences.xml`.
3. In-code `defaults` passed to the constructor. They are mirrored as bindable properties and, on iOS, registered natively too.

If you skip the platform files, layer 2 is empty and the in-code defaults are all you need.

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

### Reserved keys

A key that clashes with a member of the class (for example `set` or `keys`) is still readable through `get()`, but it is not mirrored as a bindable property. A warning is traced under the `nativescript-preferences` category.

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

### `ns-preferences` CLI

| Command | Description |
| --- | --- |
| `ns-preferences init` | Create a starter `preferences.json` and print the hook to add to `nativescript.config.ts`. |
| `ns-preferences generate` | Write the Settings.bundle, `preferences.xml`, string arrays and TypeScript module. |
| `ns-preferences check` | Exit with code 1 when any generated file is out of date. |

Options: `--config <file>` (default `preferences.json`), `--project <dir>`, `--app-resources <dir>`, `--platform ios|android`. The build hook at `hooks/before-prepare.cjs` runs `generate` for the platform being prepared and is a no-op in projects without a `preferences.json`.

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
npm test               # generator tests (node:test)
npm run demo.install   # install the demo app, linked to src/
npm run demo.ios
npm run demo.android
```

## License

Apache License Version 2.0, January 2004
