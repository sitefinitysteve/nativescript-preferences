---
name: nativescript-preferences
description: Use when adding, reading, writing or binding app settings in a NativeScript app with the nativescript-preferences plugin, editing app.preferences.ts (or a legacy preferences.json), or wiring the iOS Settings.bundle / Android PreferenceScreen it generates.
---

# nativescript-preferences

Read `llms.txt` next to this file for the complete reference (definition format, API, rules, gotchas). The essentials:

1. Settings are declared once in `app/app.preferences.ts` as `export default definePreferences({ items: [...] })`. Keys and value types are inferred from that literal; there is no generated TypeScript module. Never hand-edit `Settings.bundle/*.plist`, `res/xml/preferences.xml` or `res/values/preferences_arrays.xml`; they are regenerated on every build by the `before-prepare` hook, or by `npx ns-preferences generate`.
2. Use the default export: `import settings from './app.preferences'` and `settings.get('key')`, `settings.set('key', value)`, `settings.onChange('key', cb)`, `await settings.openSettings()`.
3. For custom UI, set `page.bindingContext = settings` and use two-way bindings such as `<Switch checked="{{ key }}" />`.
4. Add a setting by adding an item with a unique `key`, a `type` (`text`, `toggle`, `list`, `multilist`, `slider`, `label`, `group`, `screen`) and, for a `list`, a `default` that is one of its `options`. The types update immediately; the native files update on the next build.
5. Keep `app.preferences.ts` self-contained: it runs under Node at build time, so import only `nativescript-preferences` and relative `.ts` helpers there, never app code or `@nativescript/*`.
6. Platform tweaks go in the item's `ios` / `android` override object (`widget`, raw attributes, or `false` to hide). Do not reorder or wrap items to satisfy iOS layout; the generator does that.
7. A project still on `preferences.json` works unchanged (with `output.typescript` and `import { settings } from './settings.generated'`); do not add an `app.preferences.ts` next to it, the hook refuses two sources.
