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
	fs.writeFileSync(path.join(dir, 'app/settings.generated.ts'), 'stale');
	assert.equal(generator.generate(config, { projectDir: dir, check: true }).written.length, 1);
	assert.equal(fs.readFileSync(path.join(dir, 'app/settings.generated.ts'), 'utf8'), 'stale', 'check does not write');
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
	const stale = run(['check']);
	assert.equal(stale.code, 1);
	assert.match(stale.out, /out of date app\/settings\.generated\.ts/);
	fs.writeFileSync(path.join(dir, 'preferences.json'), '{ "items": [ { "type": "toggle", "key": "1bad" } ] }');
	const invalid = run(['generate']);
	assert.equal(invalid.code, 1);
	assert.match(invalid.out, /items\[0\]\.key must match/);
	const fresh = fs.mkdtempSync(path.join(os.tmpdir(), 'ns-preferences-init-'));
	fs.mkdirSync(path.join(fresh, 'src'));
	const init = execFileSync(process.execPath, [bin, 'init', '--project', fresh], { encoding: 'utf8' });
	assert.match(init, /before-prepare\.cjs/);
	assert.equal(JSON.parse(fs.readFileSync(path.join(fresh, 'preferences.json'), 'utf8')).output.typescript, 'src/settings.generated.ts');
});
