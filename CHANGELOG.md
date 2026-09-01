# Changelog

## 2.0.0

Rewritten for NativeScript 9.

### Added

- `Preferences.shared` singleton, typed getters (`getString`, `getNumber`, `getBoolean`, `getStringArray`), `has`, `keys`, `getAll`, `remove`, `refresh`, `dispose`.
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

### Deprecated

- `getValue` / `setValue` remain as aliases for `get` / `set`.

## 1.2.0

- Last release for NativeScript 6.
