'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { execFileSync } = require('node:child_process');

const generator = require('../generator/index.cjs');

const sample = {
	output: { typescript: 'app/settings.generated.ts' },
	items: [
		{
			type: 'group',
			title: 'General',
			summary: 'Footer',
			items: [
				{ key: 'name', type: 'text', title: 'Name', default: '', keyboard: 'email', secure: true },
				{ key: 'enabled', type: 'toggle', title: 'Enabled', summary: 'Turns the thing on', default: true },
				{ key: 'theme', type: 'list', title: 'Theme', default: 'system', options: [{ value: 'system', title: 'Follow system' }, 'light', 'dark'] },
				{ key: 'volume', type: 'slider', title: 'Volume', default: 50, min: 0, max: 100, step: 5 },
			],
		},
		{
			type: 'screen',
			key: 'advanced',
			title: 'Advanced',
			summary: 'Diagnostics & privacy',
			items: [
				{ key: 'analytics', type: 'toggle', title: 'Share analytics', default: false },
				{ key: 'channels', type: 'multilist', title: 'Channels', default: ['news'], options: ['news', 'offers'] },
				{ key: 'version', type: 'label', title: 'Version', value: '1.0' },
			],
		},
	],
};

function tempProject() {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ns-preferences-'));
	fs.mkdirSync(path.join(dir, 'app'));
	fs.writeFileSync(path.join(dir, 'preferences.json'), JSON.stringify(sample, null, 2));
	return dir;
}

test('renders an iOS Settings.bundle with one plist per screen', () => {
	const warnings = [];
	const files = generator.renderIos(generator.normalizeConfig(sample), warnings);
	assert.deepEqual(Array.from(files.keys()), ['Root.plist', 'advanced.plist']);
	const root = files.get('Root.plist');
	assert.match(root, /<string>PSGroupSpecifier<\/string>\s*<key>Title<\/key>\s*<string>General<\/string>\s*<key>FooterText<\/key>\s*<string>Footer<\/string>/);
	assert.match(root, /PSTextFieldSpecifier[\s\S]*<key>IsSecure<\/key>\s*<true\/>[\s\S]*<key>KeyboardType<\/key>\s*<string>EmailAddress<\/string>/);
	assert.match(root, /PSMultiValueSpecifier[\s\S]*<key>Titles<\/key>\s*<array>\s*<string>Follow system<\/string>\s*<string>light<\/string>/);
	assert.match(root, /PSSliderSpecifier[\s\S]*<key>MaximumValue<\/key>\s*<integer>100<\/integer>/);
	assert.match(root, /PSChildPaneSpecifier[\s\S]*<key>File<\/key>\s*<string>advanced<\/string>/);
	const advanced = files.get('advanced.plist');
	assert.match(advanced, /PSTitleValueSpecifier[\s\S]*<string>1\.0<\/string>/);
	assert.doesNotMatch(advanced, /channels/, 'multilist has no iOS control');
	assert.equal(warnings.length, 1);
	assert.match(warnings[0], /"channels"/);
});

test('renders AndroidX preference XML and the string arrays it references', () => {
	const files = generator.renderAndroid(generator.normalizeConfig(sample));
	assert.deepEqual(Array.from(files.keys()), ['xml/preferences.xml', 'values/preferences_arrays.xml']);
	const xml = files.get('xml/preferences.xml');
	assert.match(xml, /<PreferenceCategory\s+android:title="General"\s+android:summary="Footer"/);
	assert.match(xml, /<EditTextPreference[\s\S]*android:key="name"[\s\S]*app:useSimpleSummaryProvider="true"/);
	assert.match(xml, /<SwitchPreferenceCompat[\s\S]*android:key="enabled"[\s\S]*android:summary="Turns the thing on"[\s\S]*android:defaultValue="true"/);
	assert.match(xml, /<ListPreference[\s\S]*android:entries="@array\/pref_theme_entries"[\s\S]*android:entryValues="@array\/pref_theme_values"[\s\S]*android:defaultValue="system"/);
	assert.match(xml, /<SeekBarPreference[\s\S]*android:defaultValue="50"[\s\S]*app:min="0"[\s\S]*android:max="100"[\s\S]*app:seekBarIncrement="5"/);
	assert.match(xml, /<PreferenceScreen\s+android:key="advanced"\s+android:title="Advanced"\s+android:summary="Diagnostics &amp; privacy"/);
	assert.match(xml, /<MultiSelectListPreference[\s\S]*android:defaultValue="@array\/pref_channels_default"/);
	assert.match(xml, /<Preference[\s\S]*android:key="version"[\s\S]*android:summary="1\.0"[\s\S]*android:selectable="false"/);
	const arrays = files.get('values/preferences_arrays.xml');
	assert.match(arrays, /<string-array name="pref_theme_entries">\s*<item>Follow system<\/item>\s*<item>light<\/item>\s*<item>dark<\/item>/);
	assert.match(arrays, /<string-array name="pref_channels_default">\s*<item>news<\/item>/);
});

test('renders a typed TypeScript module with defaults and a shared instance', () => {
	const ts = generator.renderTypeScript(generator.normalizeConfig(sample));
	assert.match(ts, /export interface AppSettings \{\n\tname: string;\n\tenabled: boolean;\n\ttheme: 'system' \| 'light' \| 'dark';\n\tvolume: number;\n\tanalytics: boolean;\n\tchannels: string\[\];\n\}/);
	assert.match(ts, /export const settingsDefaults: Readonly<AppSettings> = \{\n\tname: '',\n\tenabled: true,\n\ttheme: 'system',\n\tvolume: 50,\n\tanalytics: false,\n\tchannels: \['news'\],\n\};/);
	assert.match(ts, /export const settings = new Preferences<AppSettings>\(\{ defaults: settingsDefaults \}\);/);
	assert.doesNotMatch(ts, /version/, 'labels are not stored values');
});

test('per-platform overrides swap, extend, trim and hide controls', () => {
	const config = generator.normalizeConfig({
		items: [
			{ key: 'dark', type: 'toggle', title: 'Dark', default: false, ios: { Title: 'Dark mode' }, android: { widget: 'CheckBoxPreference', 'android:icon': '@drawable/ic_dark', 'app:iconSpaceReserved': null } },
			{ key: 'theme', type: 'list', title: 'Theme', default: 'a', options: ['a', 'b'], ios: { widget: 'PSRadioGroupSpecifier' }, android: { widget: 'DropDownPreference' } },
			{ key: 'secret', type: 'text', title: 'Secret', default: '', ios: false },
			{ key: 'tags', type: 'multilist', title: 'Tags', options: ['x', 'y'], ios: { widget: 'PSMultiValueSpecifier' } },
			{ type: 'screen', key: 'adv', title: 'Advanced', ios: false, items: [{ key: 'z', type: 'toggle', default: true, android: false }] },
		],
	});
	const warnings = [];
	const ios = generator.renderIos(config, warnings);
	assert.deepEqual(Array.from(ios.keys()), ['Root.plist'], 'a screen hidden on iOS gets no plist');
	assert.equal(warnings.length, 0, 'an explicit iOS widget silences the multilist warning');
	const root = ios.get('Root.plist');
	assert.match(root, /PSToggleSwitchSpecifier[\s\S]*?<key>Title<\/key>\s*<string>Dark mode<\/string>/);
	assert.match(root, /<string>PSRadioGroupSpecifier<\/string>\s*<key>Key<\/key>\s*<string>theme<\/string>/);
	assert.doesNotMatch(root, /secret|PSChildPaneSpecifier/);
	assert.match(root, /<string>PSMultiValueSpecifier<\/string>\s*<key>Key<\/key>\s*<string>tags<\/string>/);

	const xml = generator.renderAndroid(config).get('xml/preferences.xml');
	assert.match(xml, /<CheckBoxPreference\s+android:key="dark"\s+android:title="Dark"\s+android:defaultValue="false"\s+android:icon="@drawable\/ic_dark" \/>/);
	assert.match(xml, /<DropDownPreference[\s\S]*?android:entries="@array\/pref_theme_entries"/);
	assert.match(xml, /<EditTextPreference[\s\S]*?android:key="secret"/, 'ios:false leaves Android alone');
	assert.match(xml, /<PreferenceScreen\s+android:key="adv"\s+android:title="Advanced"\s+app:iconSpaceReserved="false" \/>/, 'a child hidden on Android is dropped');

	const ts = generator.renderTypeScript(config);
	assert.match(ts, /secret: string;[\s\S]*z: boolean;/, 'hidden items are still stored and typed');

	assert.throws(() => generator.normalizeConfig({ items: [{ key: 'a', type: 'toggle', ios: 'nope' }] }), /items\[0\]\.ios must be false or an object/);
	assert.throws(() => generator.normalizeConfig({ items: [{ key: 'a', type: 'toggle', android: { widget: '' } }] }), /android\.widget must be a non-empty string such as "CheckBoxPreference"/);
	assert.throws(() => generator.normalizeConfig({ items: [{ key: 'a', type: 'toggle', ios: { widget: 7 } }] }), /ios\.widget must be a non-empty string such as "PSRadioGroupSpecifier"/);
	assert.throws(() => generator.normalizeConfig({ items: [{ key: 'a', type: 'toggle', android: { 'android:icon': { x: 1 } } }] }), /android\.android:icon must be a string, number, boolean or null/);
});

test('validates the description and points at the offending item', () => {
	const bad = (items, pattern) => assert.throws(() => generator.normalizeConfig({ items }), pattern);
	bad([{ type: 'toggle', key: 'a' }, { type: 'toggle', key: 'a' }], /items\[1\]\.key "a" is already used/);
	bad([{ type: 'toggle', key: 'bad-key' }], /items\[0\]\.key must match/);
	bad([{ type: 'list', key: 'a', options: ['x'], default: 'y' }], /default "y" is not one of the option values/);
	bad([{ type: 'slider', key: 'a', min: 10, max: 5 }], /min must be less than max/);
	bad([{ type: 'slider', key: 'a', default: 2.5 }], /must be an integer/);
	bad([{ type: 'group', items: [{ type: 'group', items: [] }] }], /a group cannot contain another group/);
	bad([{ type: 'rocket', key: 'a' }], /type must be one of/);
	bad([{ type: 'screen', key: 'a', items: [] }], /title is required for a screen/);
});

test('generate writes every file once, is idempotent and prunes stale screen plists', () => {
	const dir = tempProject();
	const config = generator.loadConfig(path.join(dir, 'preferences.json'));
	const bundle = path.join(dir, 'App_Resources/iOS/Settings.bundle');
	fs.mkdirSync(bundle, { recursive: true });
	fs.writeFileSync(path.join(bundle, 'Old.plist'), `<!-- ${generator.GENERATED_MARKER} -->`);
	fs.writeFileSync(path.join(bundle, 'Handwritten.plist'), '<plist/>');

	const first = generator.generate(config, { projectDir: dir });
	assert.deepEqual(first.written.map((file) => path.relative(dir, file)).sort(), [
		'App_Resources/Android/src/main/res/values/preferences_arrays.xml',
		'App_Resources/Android/src/main/res/xml/preferences.xml',
		'App_Resources/iOS/Settings.bundle/Root.plist',
		'App_Resources/iOS/Settings.bundle/advanced.plist',
		'app/settings.generated.ts',
	]);
	assert.deepEqual(first.removed.map((file) => path.basename(file)), ['Old.plist']);
	assert.ok(fs.existsSync(path.join(bundle, 'Handwritten.plist')), 'files without the marker are left alone');

	const second = generator.generate(config, { projectDir: dir });
	assert.equal(second.written.length, 0);
	assert.equal(second.unchanged.length, 5);

	const check = generator.generate(config, { projectDir: dir, check: true });
	assert.equal(check.written.length, 0);
	const stale = `// ${generator.GENERATED_MARKER}\nstale`;
	fs.writeFileSync(path.join(dir, 'app/settings.generated.ts'), stale);
	assert.equal(generator.generate(config, { projectDir: dir, check: true }).written.length, 1);
	assert.equal(fs.readFileSync(path.join(dir, 'app/settings.generated.ts'), 'utf8'), stale, 'check does not write');
});

test('hand-written files are kept unless forced, and outputs can be switched off', () => {
	const dir = tempProject();
	const config = generator.loadConfig(path.join(dir, 'preferences.json'));
	const plist = path.join(dir, 'App_Resources/iOS/Settings.bundle/Root.plist');
	const xml = path.join(dir, 'App_Resources/Android/src/main/res/xml/preferences.xml');
	fs.mkdirSync(path.dirname(plist), { recursive: true });
	fs.mkdirSync(path.dirname(xml), { recursive: true });
	fs.writeFileSync(plist, '<plist>mine</plist>');
	fs.writeFileSync(xml, '<PreferenceScreen>mine</PreferenceScreen>');

	const first = generator.generate(config, { projectDir: dir });
	assert.deepEqual(first.skipped.map((file) => path.basename(file)).sort(), ['Root.plist', 'preferences.xml']);
	assert.equal(fs.readFileSync(plist, 'utf8'), '<plist>mine</plist>');
	assert.equal(fs.readFileSync(xml, 'utf8'), '<PreferenceScreen>mine</PreferenceScreen>');
	assert.ok(first.written.some((file) => file.endsWith('advanced.plist')), 'files that do not exist yet are still written');

	const check = generator.generate(config, { projectDir: dir, check: true });
	assert.deepEqual(check.skipped.length, 2);
	assert.equal(check.written.length, 0, 'kept files are not reported as out of date');

	const forced = generator.generate(config, { projectDir: dir, force: true });
	assert.deepEqual(forced.written.map((file) => path.basename(file)).sort(), ['Root.plist', 'preferences.xml']);
	assert.match(fs.readFileSync(plist, 'utf8'), /Generated by nativescript-preferences/);

	// A generated file whose header was removed counts as hand-edited from then on.
	fs.writeFileSync(xml, fs.readFileSync(xml, 'utf8').replace(/<!--.*-->\n/, '').replace('Enabled', 'Enabled (mine)'));
	assert.deepEqual(generator.generate(config, { projectDir: dir }).skipped.map((file) => path.basename(file)), ['preferences.xml']);

	const off = generator.normalizeConfig({ ...sample, output: { ios: false, android: false, typescript: false } });
	const dir2 = tempProject();
	const result = generator.generate(off, { projectDir: dir2 });
	assert.deepEqual(result.written, []);
	assert.ok(!fs.existsSync(path.join(dir2, 'App_Resources')));
	assert.throws(() => generator.normalizeConfig({ items: [], output: { ios: true } }), /"output\.ios" must be a path or false/);
});

test('generate honours a custom App_Resources path and a single platform', () => {
	const dir = tempProject();
	const config = generator.loadConfig(path.join(dir, 'preferences.json'));
	const result = generator.generate(config, { projectDir: dir, appResourcesDir: path.join(dir, 'custom/App_Resources'), platforms: ['android'] });
	const written = result.written.map((file) => path.relative(dir, file)).sort();
	assert.deepEqual(written, ['app/settings.generated.ts', 'custom/App_Resources/Android/src/main/res/values/preferences_arrays.xml', 'custom/App_Resources/Android/src/main/res/xml/preferences.xml']);
});

test('the before-prepare hook generates for the platform being prepared and skips projects without a description', () => {
	const hook = require('../hooks/before-prepare.cjs');
	const dir = tempProject();
	hook({ projectData: { projectDir: dir, appResourcesDirectoryPath: path.join(dir, 'App_Resources') }, prepareData: { platform: 'iOS' } });
	assert.ok(fs.existsSync(path.join(dir, 'App_Resources/iOS/Settings.bundle/Root.plist')));
	assert.ok(!fs.existsSync(path.join(dir, 'App_Resources/Android')));
	const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'ns-preferences-empty-'));
	hook({ projectData: { projectDir: empty }, prepareData: { platform: 'android' } });
	assert.deepEqual(fs.readdirSync(empty), []);

	process.env.NS_PREFERENCES_SKIP = '1';
	try {
		hook({ projectData: { projectDir: dir }, prepareData: { platform: 'android' } });
	} finally {
		delete process.env.NS_PREFERENCES_SKIP;
	}
	assert.ok(!fs.existsSync(path.join(dir, 'App_Resources/Android')), 'NS_PREFERENCES_SKIP disables the hook');
});

test('the CLI generates, checks and reports validation errors', () => {
	const dir = tempProject();
	const bin = path.join(__dirname, '../bin/ns-preferences.cjs');
	const run = (args) => {
		try {
			return { code: 0, out: execFileSync(process.execPath, [bin, ...args], { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) };
		} catch (error) {
			return { code: error.status, out: `${error.stdout}${error.stderr}` };
		}
	};
	assert.equal(run(['generate']).code, 0);
	assert.equal(run(['check']).code, 0);
	fs.writeFileSync(path.join(dir, 'app/settings.generated.ts'), 'stale');
	const kept = run(['check']);
	assert.equal(kept.code, 0, 'a file without the header is kept, not stale');
	assert.match(kept.out, /kept app\/settings\.generated\.ts \(hand-written/);
	assert.equal(run(['generate', '--force']).code, 0);
	fs.writeFileSync(path.join(dir, 'app/settings.generated.ts'), `// ${generator.GENERATED_MARKER}\nstale`);
	const stale = run(['check']);
	assert.equal(stale.code, 1);
	assert.match(stale.out, /out of date app\/settings\.generated\.ts/);
	fs.writeFileSync(path.join(dir, 'preferences.json'), '{ "items": [ { "type": "toggle", "key": "1bad" } ] }');
	const invalid = run(['generate']);
	assert.equal(invalid.code, 1);
	assert.match(invalid.out, /items\[0\]\.key must match/);
});

test('init creates the description, registers the hook and generates in one go', () => {
	const fresh = fs.mkdtempSync(path.join(os.tmpdir(), 'ns-preferences-init-'));
	fs.mkdirSync(path.join(fresh, 'src'));
	fs.writeFileSync(path.join(fresh, 'nativescript.config.ts'), "import { NativeScriptConfig } from '@nativescript/core';\n\nexport default {\n  id: 'org.example.app',\n  appPath: 'src',\n} as NativeScriptConfig;\n");
	const bin = path.join(__dirname, '../bin/ns-preferences.cjs');
	const out = execFileSync(process.execPath, [bin, 'init', '--project', fresh], { encoding: 'utf8' });
	assert.match(out, /added the before-prepare hook to nativescript\.config\.ts/);
	assert.match(out, /import \{ settings \} from '\.\/settings\.generated'/);
	const config = fs.readFileSync(path.join(fresh, 'nativescript.config.ts'), 'utf8');
	assert.match(config, /export default \{\n  hooks: \[\{ type: 'before-prepare', script: 'node_modules\/nativescript-preferences\/hooks\/before-prepare\.cjs' \}\],\n  id: 'org\.example\.app',/);
	assert.equal(JSON.parse(fs.readFileSync(path.join(fresh, 'preferences.json'), 'utf8')).output.typescript, 'src/settings.generated.ts');
	assert.ok(fs.existsSync(path.join(fresh, 'src/settings.generated.ts')));
	assert.ok(fs.existsSync(path.join(fresh, 'App_Resources/iOS/Settings.bundle/Root.plist')));
	assert.ok(fs.existsSync(path.join(fresh, 'App_Resources/Android/src/main/res/xml/preferences.xml')));

	// Existing hooks are never touched; the user gets instructions instead.
	const busy = fs.mkdtempSync(path.join(os.tmpdir(), 'ns-preferences-init-'));
	fs.writeFileSync(path.join(busy, 'nativescript.config.ts'), "export default {\n  id: 'x',\n  hooks: [{ type: 'after-prepare', script: 'other.js' }],\n};\n");
	const busyOut = execFileSync(process.execPath, [bin, 'init', '--project', busy], { encoding: 'utf8' });
	assert.match(busyOut, /already declares hooks/);
	assert.doesNotMatch(fs.readFileSync(path.join(busy, 'nativescript.config.ts'), 'utf8'), /before-prepare/);
});
