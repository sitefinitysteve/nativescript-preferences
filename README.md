# nativescript-preferences

Native app settings for NativeScript 9. Describe them once, use them typed everywhere, and let the OS draw the settings screen.

- **One description.** `preferences.json` is the single source of truth. The iOS `Settings.bundle`, the Android `PreferenceScreen` and a typed TypeScript module are generated from it on every build.
- **Typed, never `undefined`.** Every key has a default, so `settings.get('volume')` is a `number` and `settings.get('theme')` is `'system' | 'light' | 'dark'`.
- **Bindable.** The instance is an `Observable`. Point a page at it and `{{ volume }}` just works, two-way included.
- **Live.** Change events from any source, including the OS settings UI, and the native store underneath: `NSUserDefaults` on iOS, `SharedPreferences` on Android.

<img src="https://raw.githubusercontent.com/sitefinitysteve/nativescript-preferences/master/images/ios-sample.gif" width="200" /> <img src="https://raw.githubusercontent.com/sitefinitysteve/nativescript-preferences/master/images/android-sample.gif" width="200" />

## Quick start

```bash
ns plugin add nativescript-preferences
npx ns-preferences init
```

`init` creates `preferences.json`, registers a build hook in `nativescript.config.ts`, and generates everything once. Describe your settings:

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
    }
  ]
}
```

Then use them anywhere. No platform code, no `if (isIOS)`:

```ts
import { settings } from './settings.generated';

settings.get('volume');                 // number, 50 until the user changes it
settings.get('theme');                  // 'system' | 'light' | 'dark'
settings.set('enabled', false);         // typed: a string here is a compile error
settings.set('name', null);             // back to the default

settings.onChange('theme', (theme) => applyTheme(theme));

await settings.openSettings();          // the OS renders the screen from the same JSON
```

Bind a page to it and the UI follows the store, in both directions:

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

Every `ns run`, `ns build` and `ns prepare` regenerates the platform files from `preferences.json`, so the OS screen, the schema and the defaults never drift apart.

Requires `@nativescript/core` 9 or newer. No native code to build, nothing to add to `Info.plist` or `AndroidManifest.xml`.

## What gets generated

| Output | Path |
| --- | --- |
| iOS Settings.bundle, one plist per screen | `App_Resources/iOS/Settings.bundle/Root.plist`, `<screenKey>.plist` |
| AndroidX preference screen | `App_Resources/Android/src/main/res/xml/preferences.xml` |
| Android string arrays for lists | `App_Resources/Android/src/main/res/values/preferences_arrays.xml` |
| Interface, defaults and a shared `Preferences` instance | `output.typescript` |

Files are only rewritten when their content changes, so a build never becomes slower for nothing. Generated files carry a "Do not edit" header; commit them or ignore them, both work. Edited `preferences.json` while `ns run` is watching? Run `npx ns-preferences generate` and the watcher picks the change up. In CI, `npx ns-preferences check` fails when a generated file is stale.

### Item types

Every item except `group` has a `key`, the storage key, which must be unique. `title` and `summary` are optional everywhere; iOS shows a `summary` only on groups, as footer text.

| `type` | Stores | iOS | Android | Extra fields |
| --- | --- | --- | --- | --- |
| `group` | nothing | `PSGroupSpecifier` | `PreferenceCategory` | `items` (no nested groups) |
| `screen` | nothing | `PSChildPaneSpecifier` + own plist | nested `PreferenceScreen` | `items` |
| `text` | `string` | `PSTextFieldSpecifier` | `EditTextPreference` | `default`, `secure`, `keyboard`, `autocapitalize`, `autocorrect` (the last four are iOS only) |
| `toggle` | `boolean` | `PSToggleSwitchSpecifier` | `SwitchPreferenceCompat` | `default` |
| `list` | one option value | `PSMultiValueSpecifier` | `ListPreference` | `options`, `default` |
| `multilist` | `string[]` | not rendered unless `ios.specifier` is set | `MultiSelectListPreference` | `options`, `default` |
| `slider` | integer `number` | `PSSliderSpecifier` (no title on iOS) | `SeekBarPreference` | `default`, `min`, `max`, `step` |
| `label` | nothing | `PSTitleValueSpecifier` | non-selectable `Preference` | `value` |

`options` entries are plain strings or `{ "value", "title" }`. Defaults are validated against the options, sliders against `min` and `max`, and every error names the item. Every item also accepts `ios` and `android` overrides, described next.

### Per-platform overrides

Every item takes optional `ios` and `android` objects. Set either to `false` to leave the item out of that platform's screen; it stays in the schema and the store. Or override the control: `ios.specifier` and `android.widget` swap the control type, and every other entry is written verbatim as a plist key or XML attribute. `null` removes something the generator would have written.

```json
{
  "key": "theme", "type": "list", "title": "Theme", "default": "system", "options": ["system", "light", "dark"],
  "ios": { "specifier": "PSRadioGroupSpecifier" },
  "android": { "widget": "DropDownPreference", "android:icon": "@drawable/ic_theme", "app:iconSpaceReserved": null }
}
```

```json
{ "key": "dark", "type": "toggle", "title": "Dark", "default": false, "android": { "widget": "CheckBoxPreference" } }
{ "key": "debug", "type": "toggle", "title": "Debug logging", "default": false, "ios": false }
{ "key": "tags", "type": "multilist", "options": ["news", "offers"], "ios": { "specifier": "PSMultiValueSpecifier" } }
```

The last one is how you opt a `multilist` into iOS anyway: the option arrays fit `PSMultiValueSpecifier`, so the user picks one value on iOS and several on Android. The generator validates the shape of an override, not the control you name, so anything Apple or AndroidX accepts works, including widgets from your own app.

The generated module exports the interface (`AppSettings`), the defaults (`settingsDefaults`) and the instance (`settings`). Rename them with `output.interfaceName` and `output.exportName`; move the outputs with `output.ios`, `output.android` and `output.androidResource`.

## Without the generator

Everything above is sugar over one class. Skip the JSON and declare the schema in code:

```ts
import { Preferences } from 'nativescript-preferences';

interface Settings { name: string; enabled: boolean; theme: 'system' | 'light' | 'dark'; volume: number }

export const settings = new Preferences<Settings>({
  defaults: { name: '', enabled: true, theme: 'system', volume: 50 },
});
```

A typed schema needs a default for every key. That is what makes `get()` never return `undefined`. Prefer no schema at all? `Preferences.shared` is an untyped instance of the same store, where `get()` may return `undefined` and the coercing getters (`getString`, `getNumber`, `getBoolean`, `getStringArray`) do the casting.

To let the OS render a screen for a hand-written schema, write the platform files yourself with the same keys:

| | File | Docs | Example |
| --- | --- | --- | --- |
| iOS | `App_Resources/iOS/Settings.bundle/Root.plist` | [Apple](https://developer.apple.com/library/archive/documentation/Cocoa/Conceptual/UserDefaults/Preferences/Preferences.html) | [demo](demo/App_Resources/iOS/Settings.bundle/Root.plist) |
| Android | `App_Resources/Android/src/main/res/xml/preferences.xml` | [AndroidX Preference](https://developer.android.com/develop/ui/views/components/settings) | [demo](demo/App_Resources/Android/src/main/res/xml/preferences.xml) |

Both are optional and independent. Without them, `openSettings()` still opens your app's entry in the iOS Settings app (it then lists only system permissions) and rejects with a clear error on Android. iOS supports `PSChildPaneSpecifier` child panes and registers the `DefaultValue` entries on every launch. Android needs the AndroidX widgets (`SwitchPreferenceCompat`, `EditTextPreference`, `ListPreference`, `SeekBarPreference`, `MultiSelectListPreference`, nested `PreferenceScreen`); call `registerDefaults()` once to persist the `android:defaultValue` entries.

## Platform details

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

### Defaults

Three layers, from strongest to weakest:

1. A value the user stored (in-app or through the OS UI).
2. Native defaults: the `DefaultValue` entries of `Settings.bundle` are registered on every launch on iOS; on Android call `registerDefaults()` once to persist the `android:defaultValue` entries of `preferences.xml`.
3. In-code `defaults`, from the generated module or the constructor. They are mirrored as bindable properties and, on iOS, registered natively too.

With the generator all three layers come from the same JSON, so they always agree.

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

`Schema` is an interface whose properties are `string`, `number`, `boolean` or `string[]`. A typed schema needs a default for every key and `get()` never returns `undefined`. Omit the schema for untyped access, where `get()` may return `undefined`.

| Member | Description |
| --- | --- |
| `static shared` | Untyped instance for the store behind the OS settings UI, created on first access. |
| `static changeEvent` | `"change"`, for `prefs.on(Preferences.changeEvent, handler)`. |
| `new Preferences(options?)` | `options.defaults`: one per key for a typed schema, any subset for the untyped one. `options.suiteName` selects a separate store. |
| `defaults` | The frozen in-code defaults. |
| `get(key, fallback?)` | Stored value, else `fallback`, else the default. Typed by the schema, never `undefined` for a typed one. |
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
| `ns-preferences init` | Create `preferences.json`, register the build hook in `nativescript.config.ts` and generate once. |
| `ns-preferences generate` | Write the Settings.bundle, `preferences.xml`, string arrays and TypeScript module. |
| `ns-preferences check` | Exit with code 1 when any generated file is out of date. |

Options: `--config <file>` (default `preferences.json`), `--project <dir>`, `--app-resources <dir>`, `--platform ios|android`. The build hook at `hooks/before-prepare.cjs` runs `generate` for the platform being prepared and is a no-op in projects without a `preferences.json`.

## Migrating from 1.x

Version 2 is a rewrite with a new API. The `Settings.bundle` and `preferences.xml` files you already have keep working, with one Android change noted below. Or run `npx ns-preferences init` and move their contents into `preferences.json` once; from then on they are generated.

| 1.x | 2.x |
| --- | --- |
| `import { Preferences } from 'nativescript-preferences'; const prefs = new Preferences();` | `npx ns-preferences init` and import the generated `settings`, or `Preferences.shared` for untyped access. |
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
