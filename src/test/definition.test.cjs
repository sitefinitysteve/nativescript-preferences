'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { execFileSync } = require('node:child_process');

const generator = require('../generator/index.cjs');
const bin = path.join(__dirname, '..', 'bin', 'ns-preferences.cjs');
const projectDir = path.join(__dirname, '..');

const items = [
	{
		type: 'group',
		title: 'General',
		summary: 'Footer',
		items: [
			{ key: 'name', type: 'text', title: 'Name', keyboard: 'email' },
			{ key: 'enabled', type: 'toggle', title: 'Enabled', default: true },
			{
				key: 'theme',
				type: 'list',
				title: 'Theme',
				default: 'system',
				options: [{ value: 'system', title: 'Follow system' }, 'light', 'dark'],
				ios: { widget: 'PSRadioGroupSpecifier' },
			},
			{ key: 'volume', type: 'slider', title: 'Volume', default: 50, min: 0, max: 100, step: 5 },
			{ key: 'plan', type: 'label', title: 'Plan', value: 'Pro' },
		],
	},
	{
		type: 'screen',
		key: 'advanced',
		title: 'Advanced',
		items: [
			{
				type: 'group',
				title: 'Sync',
				items: [{ key: 'topics', type: 'multilist', title: 'Topics', options: ['a', 'b'], ios: false }],
			},
		],
	},
];

const TS_DEFINITION = `import { definePreferences } from 'nativescript-preferences';
import { ITEMS } from './items';

export default definePreferences({ title: 'Demo', items: ITEMS });
`;

function temp(files) {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ns-preferences-definition-'));
	for (const [name, content] of Object.entries(files)) {
		const file = path.join(dir, name);
		fs.mkdirSync(path.dirname(file), { recursive: true });
		fs.writeFileSync(file, content);
	}
	return dir;
}

function tsProject(extra = {}) {
	return temp({
		'app/app.preferences.ts': TS_DEFINITION,
		'app/items.ts': `export const ITEMS = ${JSON.stringify(items, null, '\t')} as const;\n`,
		'nativescript.config.ts':
			"import { NativeScriptConfig } from '@nativescript/core';\nexport default { id: 'org.example.app', appPath: 'app' } as NativeScriptConfig;\n",
		...extra,
	});
}

function run(dir, ...args) {
	try {
		return {
			code: 0,
			out: execFileSync(process.execPath, [bin, ...args], {
				cwd: dir,
				encoding: 'utf8',
				stdio: ['ignore', 'pipe', 'pipe'],
			}),
		};
	} catch (error) {
		return { code: error.status, out: `${error.stdout}${error.stderr}` };
	}
}

// Loading ----------------------------------------------------------------------------------------

test('a TypeScript definition normalizes to the same config as the equivalent JSON', () => {
	const dir = tsProject();
	const fromTs = generator.loadConfig(path.join(dir, 'app/app.preferences.ts'), { projectDir });
	const fromJson = generator.normalizeConfig({ title: 'Demo', items });
	assert.equal(fromTs.source, 'app.preferences.ts');
	assert.deepEqual({ ...fromTs, source: undefined }, { ...fromJson, source: undefined });
});

test('the same definition renders the same native files as JSON, apart from the header', () => {
	const dir = tsProject();
	const fromTs = generator.loadConfig(path.join(dir, 'app/app.preferences.ts'), { projectDir });
	const fromJson = generator.normalizeConfig({ title: 'Demo', items });
	const strip = (text) =>
		text.replace(/from (app\.preferences\.ts|preferences\.json)\. Do not edit; edit \1 instead\./, '');
	for (const [name, content] of generator.renderIos(fromTs)) {
		assert.equal(strip(content), strip(generator.renderIos(fromJson).get(name)), name);
		assert.match(content, /from app\.preferences\.ts\. Do not edit; edit app\.preferences\.ts instead\./);
	}
	for (const [name, content] of generator.renderAndroid(fromTs)) {
		assert.equal(strip(content), strip(generator.renderAndroid(fromJson).get(name)), name);
	}
});

test('the loader stubs both package names and rejects everything else', () => {
	const scoped = temp({
		'app/app.preferences.ts':
			"import { definePreferences } from '@nativescript/preferences';\nexport default definePreferences({ items: [] });\n",
	});
	assert.deepEqual(generator.loadDefinition(path.join(scoped, 'app/app.preferences.ts'), { projectDir }), {
		items: [],
	});

	const core = temp({
		'app/app.preferences.ts':
			"import { definePreferences } from 'nativescript-preferences';\nimport { Application } from '@nativescript/core';\nconsole.log(Application);\nexport default definePreferences({ items: [] });\n",
	});
	assert.throws(
		() => generator.loadDefinition(path.join(core, 'app/app.preferences.ts'), { projectDir }),
		/cannot import "@nativescript\/core"\. Keep it self-contained/,
	);

	const bare = temp({
		'app/app.preferences.ts':
			"import { definePreferences } from 'nativescript-preferences';\nimport fs from 'fs';\nconsole.log(fs);\nexport default definePreferences({ items: [] });\n",
	});
	assert.throws(
		() => generator.loadDefinition(path.join(bare, 'app/app.preferences.ts'), { projectDir }),
		/cannot import "fs"/,
	);
});

test('a project on TypeScript 7 (no compiler API) gets a clear message, another without typescript too', () => {
	const seven = temp({
		'app/app.preferences.ts':
			"import { definePreferences } from 'nativescript-preferences';\nexport default definePreferences({ items: [] });\n",
		'node_modules/typescript/package.json': '{ "name": "typescript", "version": "7.0.2", "main": "index.js" }',
		'node_modules/typescript/index.js': "module.exports = { version: '7.0.2' };",
	});
	assert.throws(
		() =>
			generator.loadDefinition(path.join(seven, 'app/app.preferences.ts'), {
				projectDir: seven,
				typescriptPaths: [seven],
			}),
		/typescript 7\.0\.2 no longer includes\. Install typescript 6 as a devDependency/,
	);
	assert.throws(
		() =>
			generator.loadDefinition(path.join(seven, 'app/app.preferences.ts'), {
				projectDir: seven,
				typescriptPaths: [os.tmpdir()],
			}),
		/needs the "typescript" package \(6, as in the NativeScript 9 template\)/,
	);
});

test('a CommonJS cycle sees the current module.exports, not a stale object', () => {
	const dir = temp({
		'app/app.preferences.ts':
			"import { definePreferences } from 'nativescript-preferences';\nimport { items } from './items';\nexport const shared = ['a', 'b'];\nexport default definePreferences({ items });\n",
		'app/items.ts':
			"import { shared } from './app.preferences';\nexport const items = [{ key: 'k', type: 'list', title: 'K', default: 'a', options: shared }];\n",
	});
	// items.ts runs while app.preferences.ts is half-evaluated, so `shared` is not there yet; the point is that it gets the live exports object.
	const def = generator.loadDefinition(path.join(dir, 'app/app.preferences.ts'), { projectDir });
	assert.equal(def.items[0].key, 'k');
	const reassigned = temp({
		'app/app.preferences.js': "const b = require('./b');\nmodule.exports = { items: b.items };\n",
		'app/b.js':
			"const a = require('./app.preferences');\nexports.items = [{ key: 'seen_' + (typeof a), type: 'toggle', title: 'T' }];\n",
	});
	assert.equal(
		generator.loadDefinition(path.join(reassigned, 'app/app.preferences.js'), { projectDir }).items[0].key,
		'seen_object',
	);
});

test('a definition without a default export is an error', () => {
	const dir = temp({
		'app/app.preferences.ts':
			"import { definePreferences } from 'nativescript-preferences';\nexport const prefs = definePreferences({ items: [] });\n",
	});
	assert.throws(
		() => generator.loadDefinition(path.join(dir, 'app/app.preferences.ts'), { projectDir }),
		/must `export default definePreferences/,
	);
});

test('a CommonJS .js definition works through module.exports', () => {
	const dir = temp({
		'app/app.preferences.js':
			"const { definePreferences } = require('nativescript-preferences');\nmodule.exports = definePreferences({ items: [{ key: 'on', type: 'toggle', title: 'On', default: true }] });\n",
	});
	const config = generator.loadConfig(path.join(dir, 'app/app.preferences.js'), { projectDir });
	assert.equal(config.items[0].key, 'on');
	assert.equal(config.source, 'app.preferences.js');
});

test('a missing relative helper and a syntax error name the file', () => {
	const missing = temp({
		'app/app.preferences.ts':
			"import { definePreferences } from 'nativescript-preferences';\nimport { X } from './nope';\nexport default definePreferences({ items: X });\n",
	});
	assert.throws(
		() => generator.loadDefinition(path.join(missing, 'app/app.preferences.ts'), { projectDir }),
		/app\.preferences\.ts: cannot find "\.\/nope"/,
	);
	const broken = temp({
		'app/app.preferences.ts':
			"import { definePreferences } from 'nativescript-preferences';\nexport default definePreferences({ items: [ );\n",
	});
	assert.throws(
		() => generator.loadDefinition(path.join(broken, 'app/app.preferences.ts'), { projectDir }),
		/app\.preferences\.ts: /,
	);
});

test('unknown output options and option-object fields are rejected by name', () => {
	assert.throws(
		() => generator.normalizeConfig({ output: { andriod: false }, items: [] }),
		/"output\.andriod" is not an output option/,
	);
	assert.throws(
		() =>
			generator.normalizeConfig({
				items: [{ key: 'k', type: 'list', title: 'K', default: 'a', options: [{ value: 'a', titel: 'A' }] }],
			}),
		/items\[0\]\.options\[0\]\.titel is not an option field/,
	);
});

test('JSON-only output fields and suiteName are rejected in a definition', () => {
	assert.throws(
		() => generator.normalizeConfig({ output: { typescript: 'x.ts' }, items: [] }, { source: 'app.preferences.ts' }),
		/app\.preferences\.ts: "output\.typescript" only applies to preferences\.json/,
	);
	assert.throws(
		() => generator.normalizeConfig({ suiteName: 'group.x', items: [] }, { source: 'app.preferences.ts' }),
		/"suiteName" is not supported in a definition yet/,
	);
	assert.doesNotThrow(() => generator.normalizeConfig({ output: { typescript: 'x.ts' }, items: [] }));
});

test('validation errors from a definition are prefixed with its file name', () => {
	assert.throws(
		() =>
			generator.normalizeConfig(
				{ items: [{ key: 'theme', type: 'list', title: 'T', default: 'nope', options: ['a'] }] },
				{ source: 'app.preferences.ts' },
			),
		/^PreferencesConfigError: app\.preferences\.ts: items\[0\]\.default "nope" is not one of the option values\./,
	);
});

// Discovery --------------------------------------------------------------------------------------

test('findDefinition prefers the app folder, then the project root, then preferences.json', () => {
	const dir = temp({ 'preferences.json': '{"items":[]}' });
	assert.equal(
		generator.findDefinition({ projectDir: dir, appDir: path.join(dir, 'app') }),
		path.join(dir, 'preferences.json'),
	);
	fs.mkdirSync(path.join(dir, 'app'));
	fs.writeFileSync(path.join(dir, 'app', 'app.preferences.ts'), '');
	assert.throws(
		() => generator.findDefinition({ projectDir: dir, appDir: path.join(dir, 'app') }),
		/more than one preferences definition: app\/app\.preferences\.ts, preferences\.json/,
	);
	fs.unlinkSync(path.join(dir, 'preferences.json'));
	assert.equal(
		generator.findDefinition({ projectDir: dir, appDir: path.join(dir, 'app') }),
		path.join(dir, 'app', 'app.preferences.ts'),
	);
	assert.equal(
		generator.findDefinition({ projectDir: dir, appDir: path.join(dir, 'app'), config: 'other.ts' }),
		path.join(dir, 'other.ts'),
		'--config bypasses discovery',
	);
	assert.equal(generator.findDefinition({ projectDir: temp({}), appDir: 'app' }), undefined);
});

test('resolveAppDir reads appPath from nativescript.config.ts and falls back to src, then app', () => {
	const configured = temp({
		'nativescript.config.ts':
			"import { NativeScriptConfig } from '@nativescript/core';\nexport default { id: 'x', appPath: 'source' } as NativeScriptConfig;\n",
	});
	assert.equal(generator.resolveAppDir(configured), path.join(configured, 'source'));
	const computed = temp({
		'nativescript.config.ts':
			"import path from 'node:path';\nexport default { id: 'x', appPath: path.join('source', 'mobile') };\n",
	});
	assert.equal(
		generator.resolveAppDir(computed),
		path.join(computed, 'source', 'mobile'),
		'Node built-ins work inside the config',
	);
	const broken = temp({ 'nativescript.config.ts': "export default { id: 'x', appPath: (\n" });
	assert.throws(
		() => generator.resolveAppDir(broken),
		/could not read nativescript\.config\.ts to find appPath .*Pass --app-dir/,
	);
	const src = temp({ 'src/app.ts': '' });
	assert.equal(generator.resolveAppDir(src), path.join(src, 'src'));
	const plain = temp({});
	assert.equal(generator.resolveAppDir(plain), path.join(plain, 'app'), 'falls back to app');
});

// CLI --------------------------------------------------------------------------------------------

test('generate and check work from a TypeScript definition', () => {
	const dir = tsProject();
	const generated = run(dir, 'generate');
	assert.equal(generated.code, 0, generated.out);
	assert.match(generated.out, /wrote App_Resources\/iOS\/Settings\.bundle\/Root\.plist/);
	assert.match(generated.out, /wrote App_Resources\/iOS\/Settings\.bundle\/advanced\.plist/);
	assert.doesNotMatch(generated.out, /settings\.generated\.ts/, 'no TypeScript module for a definition');
	assert.match(
		fs.readFileSync(path.join(dir, 'App_Resources/iOS/Settings.bundle/Root.plist'), 'utf8'),
		/from app\.preferences\.ts/,
	);
	assert.equal(run(dir, 'check').code, 0);
	fs.writeFileSync(
		path.join(dir, 'app/items.ts'),
		`export const ITEMS = ${JSON.stringify([{ key: 'x', type: 'toggle', title: 'X' }])} as const;\n`,
	);
	const stale = run(dir, 'check');
	assert.equal(stale.code, 1, 'a changed helper makes the output stale');
	assert.match(stale.out, /out of date/);
});

test('init creates a TypeScript definition by default and JSON with --json', () => {
	const fresh = temp({
		'nativescript.config.ts': "export default {\n  id: 'org.example.app',\n  appPath: 'app',\n};\n",
	});
	const out = run(fresh, 'init');
	assert.equal(out.code, 0, out.out);
	assert.match(out.out, /created app\/app\.preferences\.ts/);
	assert.match(out.out, /import settings from '\.\/app\.preferences'/);
	assert.match(
		fs.readFileSync(path.join(fresh, 'app/app.preferences.ts'), 'utf8'),
		/export default definePreferences\(\{/,
	);
	assert.match(fs.readFileSync(path.join(fresh, 'nativescript.config.ts'), 'utf8'), /hooks\/before-prepare\.cjs/);
	assert.ok(fs.existsSync(path.join(fresh, 'App_Resources/iOS/Settings.bundle/Root.plist')));
	assert.ok(!fs.existsSync(path.join(fresh, 'app/settings.generated.ts')));
	assert.match(run(fresh, 'init').out, /app\/app\.preferences\.ts already exists/);

	const json = temp({});
	const jsonOut = run(json, 'init', '--json');
	assert.equal(jsonOut.code, 0, jsonOut.out);
	assert.match(jsonOut.out, /created preferences\.json/);
	assert.match(jsonOut.out, /import \{ settings \} from '\.\/settings\.generated'/);
	assert.ok(fs.existsSync(path.join(json, 'app/settings.generated.ts')));

	assert.match(run(temp({}), 'init', '--typescript', 'x.ts').out, /--typescript only applies with --json/);

	const custom = temp({});
	assert.equal(run(custom, 'init', '--json', '--config', 'config/prefs.json').code, 0);
	assert.ok(fs.existsSync(path.join(custom, 'config/prefs.json')), '--config is honoured for JSON init');
	const customTs = temp({});
	assert.equal(run(customTs, 'init', '--config', 'src/settings.preferences.ts').code, 0);
	assert.match(fs.readFileSync(path.join(customTs, 'src/settings.preferences.ts'), 'utf8'), /definePreferences/);
});

test('generate without any definition explains what to do', () => {
	const out = run(temp({}), 'generate');
	assert.equal(out.code, 1);
	assert.match(out.out, /no app\.preferences\.ts or preferences\.json found/);
});
