# nativescript-preferences

**App settings for NativeScript, declared once.** Describe them in a JSON file; get the iOS Settings screen, the Android preference screen, and a typed TypeScript API, all generated and all reading the same native store.

```ts
settings.get('theme');           // 'system' | 'light' | 'dark', never undefined
settings.set('volume', 80);      // persisted in NSUserDefaults / SharedPreferences
settings.onChange('theme', applyTheme);
await settings.openSettings();   // the OS draws the screen
```

- **No platform code.** One API on both OSes. No `if (isIOS)`, no plist, no XML written by hand.
- **Typed for real.** Keys, value types and option literals come from the JSON. Every key has a default, so reads are never `undefined`.
- **Live everywhere.** Change a value in the OS settings, in your code, or through a two-way binding, and everything else updates.
- **Native UI for free.** iOS gets a page in the Settings app, Android gets an AndroidX `PreferenceScreen`. Or bind your own screen to the same instance.

## Quick start

```bash
ns plugin add nativescript-preferences
npx ns-preferences init
```

`init` creates `preferences.json`, adds a build hook to `nativescript.config.ts`, and generates once. Describe your settings:

```json
{
  "$schema": "node_modules/nativescript-preferences/preferences.schema.json",
  "output": { "typescript": "app/settings.generated.ts" },
  "items": [
    {
      "type": "group",
      "title": "General",
      "items": [
        {
          "key": "enabled",
          "type": "toggle",
          "title": "Enabled",
          "default": true
        },
        {
          "key": "theme",
          "type": "list",
          "title": "Theme",
          "default": "system",
          "options": [
            { "value": "system", "title": "Follow system" },
            { "value": "light", "title": "Light" },
            { "value": "dark", "title": "Dark" }
          ]
        },
        {
          "key": "volume",
          "type": "slider",
          "title": "Volume",
          "default": 50,
          "min": 0,
          "max": 100
        }
      ]
    }
  ]
}
```

Use them anywhere:

```ts
import { settings } from './settings.generated';

settings.get('volume');                          // number
settings.set('enabled', false);                  // a string here is a compile error
settings.set('theme', null);                     // back to the default
const stop = settings.onChange('theme', (theme) => applyTheme(theme));
```

Or bind a page to it. The instance is an `Observable`, so bindings work in both directions:

```ts
page.bindingContext = settings;
```

```xml
<Switch checked="{{ enabled }}" />
<Slider value="{{ volume }}" minValue="0" maxValue="100" />
```

Every `ns run`, `ns build` and `ns prepare` regenerates the platform files, so the OS screen, the types and the defaults can't drift. Requires `@nativescript/core` 9. No native code, no manifest or `Info.plist` changes.

## What gets generated

| Output | Path |
| --- | --- |
| iOS Settings.bundle, one plist per screen | `App_Resources/iOS/Settings.bundle/` |
| AndroidX preference screen and its string arrays | `App_Resources/Android/src/main/res/xml/preferences.xml`, `values/preferences_arrays.xml` |
| Interface, defaults and the `settings` instance | `output.typescript` |

Only changed files are written. Generated files carry a "Do not edit" header; files without it are never overwritten. `npx ns-preferences generate` runs it by hand, `npx ns-preferences check` fails CI when output is stale.

### Item types

Every item except `group` has a unique `key`. `title` and `summary` are optional (iOS shows `summary` only on groups, as footer text).

| `type` | Stores | iOS | Android | Fields |
| --- | --- | --- | --- | --- |
| `group` | nothing | `PSGroupSpecifier` | `PreferenceCategory` | `items` |
| `screen` | nothing | `PSChildPaneSpecifier` | nested `PreferenceScreen` | `items` |
| `text` | `string` | `PSTextFieldSpecifier` | `EditTextPreference` | `default`, `secure`, `keyboard`, `autocapitalize`, `autocorrect` (iOS) |
| `toggle` | `boolean` | `PSToggleSwitchSpecifier` | `SwitchPreferenceCompat` | `default` |
| `list` | one option | `PSMultiValueSpecifier` | `ListPreference` | `options`, `default` |
| `multilist` | `string[]` | needs `ios.widget` | `MultiSelectListPreference` | `options`, `default` |
| `slider` | integer | `PSSliderSpecifier` (no title) | `SeekBarPreference` | `default`, `min`, `max`, `step` |
| `label` | nothing | `PSTitleValueSpecifier` | `Preference` | `value` |

`options` are strings or `{ "value", "title" }`. Defaults are validated, and every error names the item.

### Per-platform overrides

Add `ios` or `android` to any item. `false` hides it on that platform. `widget` swaps the control; any other entry is written verbatim as a plist key or XML attribute, and `null` removes one.

```json
{
  "key": "theme",
  "type": "list",
  "title": "Theme",
  "default": "system",
  "options": ["system", "light", "dark"],
  "ios": { "widget": "PSRadioGroupSpecifier" },
  "android": {
    "widget": "DropDownPreference",
    "android:icon": "@drawable/ic_theme",
    "app:iconSpaceReserved": null
  }
}
```

Any control that stores the same shape of data is a safe swap ([Apple reference](https://developer.apple.com/library/archive/documentation/PreferenceSettings/Conceptual/SettingsApplicationSchemaReference/Introduction/Introduction.html), [AndroidX reference](https://developer.android.com/reference/androidx/preference/package-summary)):

| Stores | iOS `widget` | Android `widget` |
| --- | --- | --- |
| `boolean` | `PSToggleSwitchSpecifier` | `SwitchPreferenceCompat`, `CheckBoxPreference` |
| `string` | `PSTextFieldSpecifier` | `EditTextPreference` |
| one option | `PSMultiValueSpecifier`, `PSRadioGroupSpecifier` | `ListPreference`, `DropDownPreference` |
| `string[]` | `PSMultiValueSpecifier` (picks one) | `MultiSelectListPreference` |
| integer | `PSSliderSpecifier` | `SeekBarPreference` |
| read-only | `PSTitleValueSpecifier` | `Preference` |

Fully qualified Android classes work too. The generator checks the shape of an override, not the name.

### Keeping control

- **Hand-edit a file.** Remove its "Generated by nativescript-preferences" header and the generator leaves it alone. `generate --force` takes it back.
- **Stop generating one output.** `"output": { "android": false }` and write that file yourself.
- **Skip the hook.** `NS_PREFERENCES_SKIP=1 ns run ios` for one build, or remove the `hooks` entry from `nativescript.config.ts` for good.

Existing hand-written `Root.plist` or `preferences.xml` files are kept on the first run for the same reason.

## Without the generator

Everything above is sugar over one class:

```ts
import { Preferences } from 'nativescript-preferences';

interface Settings { enabled: boolean; theme: 'system' | 'light' | 'dark'; volume: number }

export const settings = new Preferences<Settings>({
  defaults: { enabled: true, theme: 'system', volume: 50 },
});
```

A typed schema needs a default per key; that is what makes `get()` never `undefined`. `Preferences.shared` is the untyped instance, where `get()` may return `undefined` and `getString` / `getNumber` / `getBoolean` / `getStringArray` coerce. For an OS screen, write [`Root.plist`](demo/App_Resources/iOS/Settings.bundle/Root.plist) and [`preferences.xml`](demo/App_Resources/Android/src/main/res/xml/preferences.xml) yourself with the same keys.

## Platform details

**Android settings page.** Android has no OS-hosted settings, so `openSettings()` navigates the topmost `Frame` to a page rendering `preferences.xml` with `PreferenceFragmentCompat`. Nested screens open as pages, back works. Options (all ignored on iOS): `title`, `resource`, `rootKey`, `modal`, `frame`, `animated`. CSS classes `ns-preferences-page` and `ns-preferences`.

**Embed it.** `<prefs:PreferencesView resource="preferences" />` hosts the Android screen in any page, tab or modal (`xmlns:prefs="nativescript-preferences"`). It renders nothing on iOS; `PreferencesView.isSupported` tells you. Handle `navigateToScreen` and set `args.handled = true` to present nested screens yourself.

**Defaults, strongest first.** The stored value; the native defaults (`Settings.bundle` `DefaultValue`s registered on launch, `preferences.xml` `android:defaultValue`s via `registerDefaults()`); the in-code defaults. With the generator all three come from the same JSON.

**Separate stores.** `new Preferences({ suiteName: 'group.com.example.app' })` opens an iOS App Group suite or an Android `SharedPreferences` file. Pass the same `suiteName` to `PreferencesView` to edit it.

**Value types.** `string`, `boolean`, `number` and `string[]` map to `NSString`/`String`, `Bool`/`boolean`, `Integer` or `Double`/`int`, `long` or `float` (Android keeps a key's existing Java type), and `NSArray`/`Set<String>`. A key named like a class member (`set`, `keys`) is readable via `get()` but not bindable; a warning is traced.

## API

### `Preferences<Schema>`

| Member | Description |
| --- | --- |
| `static shared` | Untyped instance of the store behind the OS settings UI. |
| `new Preferences({ defaults?, suiteName? })` | Defaults: one per key for a typed schema, any subset untyped. |
| `get(key, fallback?)` | Stored value, else `fallback`, else the default. |
| `getString / getNumber / getBoolean / getStringArray(key, fallback?)` | Coerced reads. |
| `set(key, value)` | Writes; `null` or `undefined` removes the key. |
| `remove(key)`, `clear()` | Remove one key or all. Defaults stay in effect. |
| `has(key)`, `keys()`, `getAll()` | Inspect the store. `has` ignores defaults. |
| `onChange(callback)`, `onChange(key, callback)` | Subscribe; returns an unsubscribe function. Also `on('change')`. |
| `refresh()` | Re-read the native store and raise events for differences. |
| `registerDefaults()` | iOS: register `Settings.bundle` defaults. Android: persist `preferences.xml` defaults. |
| `openSettings(options?)` | Open the OS settings UI. Resolves `true` once presented. |
| `ios` / `android` | The underlying `NSUserDefaults` / `SharedPreferences`. |
| `dispose()` | Stop observing native changes (short-lived instances only). |

### `PreferencesView`

`resource`, `suiteName`, `rootKey` properties; `navigateToScreen` event with `{ key, title, handled }`; `static isSupported`.

### `ns-preferences` CLI

| Command | Description |
| --- | --- |
| `init` | Create `preferences.json`, register the build hook, generate once. |
| `generate` | Write all outputs. `--force` overwrites files without the generated header. |
| `check` | Exit 1 when any generated file is stale. |

Options: `--config`, `--project`, `--app-resources`, `--platform ios|android`. The hook lives at `hooks/before-prepare.cjs`.

## Development

```bash
npm run build          # compile src/
npm test               # generator tests
npm run demo.install && npm run demo.ios   # or demo.android
```

Releases are cut from tags: bump `src/package.json`, add the `## x.y.z` changelog section, then `git tag v2.0.0 && git push origin master v2.0.0`. The Release workflow publishes the GitHub release with those notes and the npm tarball attached. `npm publish` from `src/` is manual.

## License

Apache 2.0
