#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const generator = require('../generator/index.cjs');

const USAGE = `Usage: ns-preferences <command> [options]

Commands
  generate   Write Settings.bundle, preferences.xml and the TypeScript module from preferences.json
  init       Create preferences.json, register the build hook in nativescript.config.ts and generate once
  check      Exit with code 1 when the generated files are out of date (for CI)

Options
  --config <file>          Path to preferences.json (default: ./preferences.json)
  --project <dir>          Project root (default: current directory)
  --app-resources <dir>    App_Resources directory (default: <project>/App_Resources)
  --platform <ios|android> Generate for one platform only
  --typescript <file>      Where init should point the generated TypeScript module
  -h, --help               Show this help
`;

function parseArgs(argv) {
	const options = { command: undefined, platforms: undefined };
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		const next = () => {
			if (i + 1 >= argv.length) {
				throw new Error(`${arg} needs a value.`);
			}
			return argv[++i];
		};
		switch (arg) {
			case '--config':
				options.config = next();
				break;
			case '--project':
				options.project = next();
				break;
			case '--app-resources':
				options.appResources = next();
				break;
			case '--platform': {
				const platform = next();
				if (platform !== 'ios' && platform !== 'android') {
					throw new Error('--platform must be ios or android.');
				}
				options.platforms = [platform];
				break;
			}
			case '--typescript':
				options.typescript = next();
				break;
			case '-h':
			case '--help':
				options.command = 'help';
				break;
			default:
				if (arg.startsWith('-')) {
					throw new Error(`Unknown option ${arg}.`);
				}
				if (options.command) {
					throw new Error(`Unexpected argument ${arg}.`);
				}
				options.command = arg;
		}
	}
	return options;
}

function relative(projectDir, file) {
	return path.relative(projectDir, file) || '.';
}

function report(projectDir, result, check) {
	for (const warning of result.warnings) {
		console.warn(`ns-preferences: warning: ${warning}`);
	}
	for (const file of result.written) {
		console.log(`ns-preferences: ${check ? 'out of date' : 'wrote'} ${relative(projectDir, file)}`);
	}
	for (const file of result.removed) {
		console.log(`ns-preferences: removed ${relative(projectDir, file)}`);
	}
	if (!result.written.length && !result.removed.length) {
		console.log('ns-preferences: everything is up to date.');
	}
}

const HOOK_LINE = "hooks: [{ type: 'before-prepare', script: 'node_modules/nativescript-preferences/hooks/before-prepare.cjs' }],";

/**
 * Adds the before-prepare hook to nativescript.config.ts (or .js). Returns 'added', 'present' or
 * 'manual' when the file could not be edited safely.
 */
function registerHook(projectDir) {
	const configPath = ['nativescript.config.ts', 'nativescript.config.js'].map((name) => path.join(projectDir, name)).find((file) => fs.existsSync(file));
	if (!configPath) {
		return { status: 'manual' };
	}
	const source = fs.readFileSync(configPath, 'utf8');
	if (source.includes('hooks/before-prepare.cjs')) {
		return { status: 'present', configPath };
	}
	if (/\bhooks\s*:/.test(source)) {
		return { status: 'manual', configPath, reason: 'it already declares hooks' };
	}
	const match = /(export\s+default\s*\{|module\.exports\s*=\s*\{)([ \t]*\r?\n)([ \t]*)/.exec(source);
	if (!match) {
		return { status: 'manual', configPath, reason: 'its shape was not recognised' };
	}
	const indent = match[3] || '  ';
	const insertAt = match.index + match[1].length + match[2].length;
	const updated = source.slice(0, insertAt) + indent + HOOK_LINE + match[2] + source.slice(insertAt);
	fs.writeFileSync(configPath, updated);
	return { status: 'added', configPath };
}

function init(projectDir, configFile, typescriptTarget) {
	if (fs.existsSync(configFile)) {
		throw new Error(`${relative(projectDir, configFile)} already exists.`);
	}
	const typescript = typescriptTarget || (fs.existsSync(path.join(projectDir, 'src')) && !fs.existsSync(path.join(projectDir, 'app')) ? 'src/settings.generated.ts' : 'app/settings.generated.ts');
	const starter = {
		$schema: 'node_modules/nativescript-preferences/preferences.schema.json',
		output: { typescript },
		items: [
			{
				type: 'group',
				title: 'General',
				items: [
					{ key: 'name', type: 'text', title: 'Name', default: '' },
					{ key: 'enabled', type: 'toggle', title: 'Enabled', summary: 'Turns the thing on', default: true },
					{
						key: 'theme',
						type: 'list',
						title: 'Theme',
						default: 'system',
						options: [
							{ value: 'system', title: 'Follow system' },
							{ value: 'light', title: 'Light' },
							{ value: 'dark', title: 'Dark' },
						],
					},
					{ key: 'volume', type: 'slider', title: 'Volume', default: 50, min: 0, max: 100 },
				],
			},
		],
	};
	fs.writeFileSync(configFile, JSON.stringify(starter, null, 2) + '\n');
	console.log(`ns-preferences: created ${relative(projectDir, configFile)}`);

	const hook = registerHook(projectDir);
	if (hook.status === 'added') {
		console.log(`ns-preferences: added the before-prepare hook to ${relative(projectDir, hook.configPath)}`);
	} else if (hook.status === 'present') {
		console.log(`ns-preferences: ${relative(projectDir, hook.configPath)} already has the hook`);
	}

	const result = generator.generate(generator.loadConfig(configFile), { projectDir });
	for (const file of result.written) {
		console.log(`ns-preferences: wrote ${relative(projectDir, file)}`);
	}

	console.log('');
	if (hook.status === 'manual') {
		const where = hook.configPath ? `${relative(projectDir, hook.configPath)} was not changed because ${hook.reason}` : 'no nativescript.config.ts was found';
		console.log(`${where}. Add this to the config object so every build regenerates the platform files:`);
		console.log('');
		console.log(`  ${HOOK_LINE}`);
		console.log('');
	}
	const importPath = './' + path.basename(typescript, '.ts');
	console.log('Done. Edit preferences.json to describe your settings, then use them anywhere:');
	console.log('');
	console.log(`  import { settings } from '${importPath}';`);
	console.log("  settings.get('volume');        // number");
	console.log('  await settings.openSettings(); // the OS renders the screen');
}

function main(argv) {
	let options;
	try {
		options = parseArgs(argv);
	} catch (error) {
		console.error(`ns-preferences: ${error.message}`);
		console.error(USAGE);
		return 2;
	}
	const command = options.command || 'help';
	if (command === 'help') {
		console.log(USAGE);
		return 0;
	}
	const projectDir = path.resolve(options.project || process.cwd());
	const configFile = path.resolve(projectDir, options.config || generator.DEFAULT_CONFIG_FILE);
	try {
		if (command === 'init') {
			init(projectDir, configFile, options.typescript);
			return 0;
		}
		if (command !== 'generate' && command !== 'check') {
			console.error(`ns-preferences: unknown command "${command}".`);
			console.error(USAGE);
			return 2;
		}
		const config = generator.loadConfig(configFile);
		const result = generator.generate(config, {
			projectDir,
			appResourcesDir: options.appResources ? path.resolve(projectDir, options.appResources) : undefined,
			platforms: options.platforms,
			check: command === 'check',
		});
		report(projectDir, result, command === 'check');
		return command === 'check' && result.written.length ? 1 : 0;
	} catch (error) {
		console.error(`ns-preferences: ${error.message}`);
		return 1;
	}
}

process.exitCode = main(process.argv.slice(2));
