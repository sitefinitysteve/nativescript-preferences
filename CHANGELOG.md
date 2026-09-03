# Changelog

## 2.0.0

nativescript-preferences 2.0 is a rewrite for NativeScript 9 around one idea: describe your app's settings once, and use them the same way on both platforms.

**Highlights**

- **One `preferences.json`.** Keys, types, defaults, titles and grouping live in a single file with a JSON Schema for editor completion. `npx ns-preferences init` creates it, registers a build hook, and generates everything once.
- **Generated platform files.** Every build produces the iOS `Settings.bundle` (one plist per screen), the Android `PreferenceScreen` XML with its string arrays, and a typed TypeScript module. Only changed files are written; hand-edited files are never overwritten.
- **One typed API.** `settings.get('theme')` is `'system' | 'light' | 'dark'` and never `undefined`. `set`, `onChange` and `openSettings()` work the same on iOS and Android, backed by `NSUserDefaults` and `SharedPreferences`.
- **Live and bindable.** Change events from any source, including the OS settings UI. The instance is an `Observable`, so it works as a `bindingContext` with two-way bindings.
- **Per-platform overrides when you want them.** Swap a control (`"android": { "widget": "CheckBoxPreference" }`), add raw attributes, or hide an item on one platform with `false`.

Install with `ns plugin add nativescript-preferences`, then `npx ns-preferences init`. The README has the full walkthrough. Existing `Settings.bundle` and `preferences.xml` files keep working and are never overwritten; `getValue` / `setValue` from 1.x become `get` / `set`.

### Added

- `preferences.json` and the `ns-preferences` CLI (`init`, `generate`, `check`, `--force`), a `before-prepare` hook for `nativescript.config.ts`, and `preferences.schema.json`.
- Generated outputs: `Settings.bundle` with child panes, `res/xml/preferences.xml` using AndroidX widgets, `res/values/preferences_arrays.xml`, and a TypeScript module exporting the interface, the defaults and a shared `Preferences` instance.
- Item types `group`, `screen`, `text`, `toggle`, `list`, `multilist`, `slider` and `label`, with validation that names the offending item.
- Per-item `ios` / `android` overrides: `widget` swaps the control, other entries are written verbatim as plist keys or XML attributes, `null` removes one, `false` hides the item on that platform.
- Opt-outs: files without the generated header are kept, any output can be switched off with `false`, and `NS_PREFERENCES_SKIP=1` disables the hook for a build.
- Typed schema with in-code defaults: `new Preferences<Settings>({ defaults })` requires a default per key and gives typed `get`, `set`, `onChange` and reads that are never `undefined`. Defaults are mirrored as bindable properties and registered natively on iOS.
- `Preferences.shared` singleton, coercing getters (`getString`, `getNumber`, `getBoolean`, `getStringArray`), `has`, `keys`, `getAll`, `remove`, `refresh`, `dispose`.
- Change events from any source, including the OS settings UI: `on('change')`, `onChange(callback)`, `onChange(key, callback)`.
- `PreferencesView`, a view that hosts the Android preference screen inside any page, tab or modal, with a `navigateToScreen` event for nested screens.
- `openSettings(options)` on Android: page title, alternative `res/xml` resource, nested `rootKey`, modal presentation, explicit `Frame`.
- `registerDefaults()` on both platforms. iOS parses `Settings.bundle` (including child panes) and registers real `DefaultValue`s; Android persists `android:defaultValue`s.
- Separate stores through `new Preferences({ suiteName })` (iOS App Group suites, Android `SharedPreferences` files).
- `string[]` values (`MultiSelectListPreference` / `NSArray`).

### Changed

- Android uses AndroidX Preference (`PreferenceFragmentCompat`) rendered inside a NativeScript page instead of a prebuilt `.aar` with a deprecated `PreferenceActivity`. No manifest entries are needed.
- Android number handling keeps the Java type a key already has, so `SeekBarPreference` and friends keep working after in-app writes.
- iOS defaults registration uses the real `DefaultValue` entries instead of empty strings.
- `openSettings()` returns a `Promise<boolean>` on both platforms.
- Package targets `@nativescript/core` 9 (`tns-core-modules` is gone) and ships ES modules with a hand-written `index.d.ts`.

### Removed

- `getValue` / `setValue`. Use `get` / `set`; see the migration table in the README.

## 1.2.0

- Last release for NativeScript 6.
