---
name: nativescript-preferences
description: Use when adding, reading, writing or binding app settings in a NativeScript app with the nativescript-preferences plugin, editing preferences.json, or wiring the iOS Settings.bundle / Android PreferenceScreen it generates.
---

# nativescript-preferences

Read `llms.txt` next to this file for the complete reference (JSON format, API, rules, gotchas). The essentials:

1. Settings are declared once in `preferences.json` (validated by `preferences.schema.json`). Never hand-edit `Settings.bundle/*.plist`, `res/xml/preferences.xml`, `res/values/preferences_arrays.xml` or `settings.generated.ts`; they are regenerated on every build by the `before-prepare` hook, or by `npx ns-preferences generate`.
2. Use the generated module: `import { settings } from './settings.generated'` and `settings.get('key')`, `settings.set('key', value)`, `settings.onChange('key', cb)`, `await settings.openSettings()`.
3. For custom UI, set `page.bindingContext = settings` and use two-way bindings such as `<Switch checked="{{ key }}" />`.
4. Add a setting by adding an item to `preferences.json` with a unique `key`, a `type` (`text`, `toggle`, `list`, `multilist`, `slider`, `label`, `group`, `screen`) and a `default`, then run `npx ns-preferences generate` so the TypeScript types update.
5. Platform tweaks go in the item's `ios` / `android` override object (`widget`, raw attributes, or `false` to hide). Do not reorder or wrap items to satisfy iOS layout; the generator does that.
