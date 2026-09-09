# Changelog

## 3.0.0

Settings are now declared in TypeScript. `app/app.preferences.ts` exports `definePreferences({ items })`; keys, value types and option literals are inferred from the literal, and the same file is the runtime instance, so there is no generated `settings.generated.ts` any more. The build hook evaluates the file under Node, the way the NativeScript CLI reads `nativescript.config.ts`, and writes `Settings.bundle` and `preferences.xml` from it exactly as before. Suggested by the NativeScript core team on the RFC: https://github.com/NativeScript/rfcs/pull/54#issuecomment-5593575051

**Breaking**

- Requires TypeScript 6, the version NativeScript 9 ships with; the typings use `const` type parameters, so the floor is 5.3, and 7.0 is verified too. Projects on `preferences.json` are affected, since the typings are shared. Reading the definition at build time needs the TypeScript compiler API, which 7.x dropped: the hook uses the project's `typescript` when it has it, else the NativeScript CLI's own copy, else explains what to install.
- `npx ns-preferences init` creates `app/app.preferences.ts`. Pass `--json` for the previous behaviour; `--typescript <file>` now only applies with `--json`.

**Added**

- `definePreferences(definition)`: returns `Preferences<InferPreferences<typeof definition>>`. A `list` default that is not one of its options, a `multilist` default outside its options, a group inside a group, or a misspelled property is a compile error. The definition stays reachable as `settings.definition`.
- Types: `PreferencesDefinition`, `PreferenceItem` and the per-type item interfaces, `InferPreferences<D>`, `PreferencePlatformOverride`.
- The hook and the CLI find `app.preferences.ts` (or `.js`) in the app folder (`appPath` from `nativescript.config.ts`, else `src`, else `app`) or the project root, then fall back to `preferences.json`. Both present at once is an error. New CLI options `--app-dir` and `--json`.
- Relative `.ts` / `.js` helper imports work inside the definition. Any other import is rejected with a message, since the file runs in Node at build time.
- Generated files name the definition they came from in their header.

**Unchanged**

- `preferences.json` projects: same schema, same `output.typescript`, same generated module.
- The `Preferences` class, `PreferencesView`, the native stores, and every generated plist / XML byte.

## 2.0.2

- iOS registered in-code defaults after the `Settings.bundle` ones, so a hand-written bundle value lost to the in-code one, the opposite of what the README said. The bundle now wins where both define a key. Generated projects are unaffected; both come from the same JSON.
- `MultiWindowEnabled`, and any other `MultiWindow*` key iOS writes, is now filtered from `keys()`, `getAll()` and the global change event. The README already claimed it was.
- README: `widget` overrides are not validated by the generator, and the docs no longer suggest they are. Spelled out what `registerDefaults()` does on Android.

## 2.0.1

- README screenshots use absolute URLs so they render on npmjs.com. No code changes.

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
- `Preferences.applicationSettings`: the store `@nativescript/core`'s `ApplicationSettings` uses, for reading existing values through this API. Same as `shared` on iOS; Android's `ApplicationSettings` writes to a separate `prefs.db` file.
- `PreferencesOptions.integers`: keys that round on write, so a bound iOS `Slider` never stores 15.0038 in an integer key. The generated module lists every `slider`.
- The plugin registers its XML namespace with the runtime module registry when imported, so `<prefs:PreferencesView>` works under Vite as well as webpack.
- iOS system defaults (`NSHyphenatesAsLastResort`, `AppleLanguages`, `MultiWindowEnabled`...) are kept out of `keys()`, `getAll()`, bindable properties and change events; `systemKeyPattern` exposes the filter. Writes notify exactly once on both platforms.
- The generator applies two iOS layout rules itself: a `PSRadioGroupSpecifier` is emitted last in its group and a `screen` sharing a group with other rows gets its own card. `generate` prints notes for choices it made (an item moved, a `multilist` left out of Settings.bundle); the build hook stays quiet.
- `llms.txt` and `SKILL.md`, a reference for AI assistants, shipped in the package.
- Android returns `string[]` values sorted, because `SharedPreferences` hands a `Set<String>` back in arbitrary order; without this a `multilist` raised a phantom change event on every launch.
- `PreferencesOptions.integers` (see Fixed).
- `Preferences.shared` singleton, coercing getters (`getString`, `getNumber`, `getBoolean`, `getStringArray`), `has`, `keys`, `getAll`, `remove`, `refresh`, `dispose`.
- Change events from any source, including the OS settings UI: `on('change')`, `onChange(callback)`, `onChange(key, callback)`.
- `PreferencesView`, a view that hosts the Android preference screen inside any page, tab or modal, with a `navigateToScreen` event for nested screens.
- `openSettings(options)` on Android: page title, alternative `res/xml` resource, nested `rootKey`, modal presentation, explicit `Frame`.
- `registerDefaults()` on both platforms. iOS parses `Settings.bundle` (including child panes) and registers real `DefaultValue`s; Android persists `android:defaultValue`s.
- Separate stores through `new Preferences({ suiteName })` (iOS App Group suites, Android `SharedPreferences` files).
- `string[]` values (`MultiSelectListPreference` / `NSArray`).

### Added

- `Preferences.applicationSettings`: the store `@nativescript/core`'s `ApplicationSettings` uses, for reading existing values through this API. Same as `shared` on iOS; Android's `ApplicationSettings` writes to a separate `prefs.db` file.
- `PreferencesOptions.integers` (see Fixed).

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
