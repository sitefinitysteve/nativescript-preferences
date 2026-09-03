#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const generator = require('../generator/index.cjs');

const USAGE = `Usage: ns-preferences <command> [options]

Commands
  generate   Write Settings.bundle, preferences.xml and the TypeScript module from preferences.json
  init       Create a starter preferences.json and print the nativescript.config.ts hook to add
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
	console.log(`ns-preferences: created ${relative(projectDir, configFile)}.`);
	console.log('');
	console.log('Add the build hook to nativescript.config.ts so the platform files are regenerated on every build:');
	console.log('');
	console.log("  hooks: [{ type: 'before-prepare', script: 'node_modules/nativescript-preferences/hooks/before-prepare.cjs' }],");
	console.log('');
	console.log(`Then import { settings } from './${path.basename(typescript, '.ts')}' in your app. Run "npx ns-preferences generate" to generate right now.`);
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
