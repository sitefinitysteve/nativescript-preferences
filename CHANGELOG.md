# Changelog

## 2.0.0

Rewritten for NativeScript 9.

### Added

- `preferences.json`: describe the settings once and generate `Settings.bundle` (one plist per screen), `res/xml/preferences.xml`, the string arrays it references and a typed TypeScript module (`interface`, defaults and a shared `Preferences` instance). Ships as the `ns-preferences` CLI (`init`, `generate`, `check`), a `before-prepare` hook for `nativescript.config.ts` and a JSON Schema for editor completion.
- Typed schema and in-code defaults: `new Preferences<Settings>({ defaults })` gives typed `get`, `set`, `onChange` and never-undefined reads. Defaults are mirrored as bindable properties and registered natively on iOS.
- `Preferences.shared` singleton, coercing getters (`getString`, `getNumber`, `getBoolean`, `getStringArray`), `has`, `keys`, `getAll`, `remove`, `refresh`, `dispose`.
- Change events from any source, including the OS settings UI: `on('change')`, `onChange(callback)`, `onChange(key, callback)`.
- The instance is an `Observable` that mirrors stored keys as properties, so it can be used as a `bindingContext` with one-way and two-way bindings.
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
