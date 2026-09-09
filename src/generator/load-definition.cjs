'use strict';

/**
 * Loads an `app.preferences.ts` definition under Node, the way the NativeScript CLI loads
 * `nativescript.config.ts`: transpile with the project's `typescript`, then run the CommonJS
 * output with a `require` that stubs this package. The definition file must stay self-contained:
 * it may import this package and relative `.ts` / `.js` helpers, nothing else.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const Module = require('module');

const PLUGIN_NAMES = ['nativescript-preferences', '@nativescript/preferences'];
const DEFINITION_FILES = ['app.preferences.ts', 'app.preferences.js'];
const JSON_FILE = 'preferences.json';
const RELATIVE = /^\.\.?[\\/]/;
const EXTENSIONS = ['', '.ts', '.js', '/index.ts', '/index.js'];
const NODE_BUILTINS = new Set(Module.builtinModules);

/**
 * The `typescript` to transpile with: the project's own, else the NativeScript CLI's (the hook runs
 * inside the CLI process, so `require.main` is the CLI), else this package's. TypeScript 7 no longer
 * ships the JavaScript compiler API, so a copy without `transpileModule` is skipped.
 */
function findTypescript(projectDir, searchPaths) {
	const paths = searchPaths || [projectDir];

	if (!searchPaths && require.main && require.main.filename) {
		paths.push(path.dirname(require.main.filename));
	}

	if (!searchPaths) {
		paths.push(__dirname);
	}

	let seen;

	for (const dir of paths) {
		let resolved;

		try {
			resolved = require.resolve('typescript', { paths: [dir] });
		} catch (error) {
			continue;
		}

		const ts = require(resolved);

		if (typeof ts.transpileModule === 'function') {
			return ts;
		}

		seen = seen || ts.version;
	}

	if (seen) {
		throw new Error(
			`reading app.preferences.ts needs the TypeScript compiler API, which typescript ${seen} no longer includes. Install typescript 6 as a devDependency, the version the NativeScript 9 template uses.`,
		);
	}

	throw new Error(
		'reading app.preferences.ts needs the "typescript" package (6, as in the NativeScript 9 template). Add it as a devDependency; every NativeScript app that builds already has it.',
	);
}

function relative(projectDir, file) {
	return path.relative(projectDir, file) || path.basename(file);
}

/** Transpiles and runs one file, returning its `module.exports`. Relative imports recurse here. */
function evaluate(file, projectDir, ts, cache, options) {
	if (cache.has(file)) {
		return cache.get(file).exports;
	}

	const name = relative(projectDir, file);
	const source = fs.readFileSync(file, 'utf8');
	const output = ts.transpileModule(source, {
		fileName: file,
		reportDiagnostics: true,
		compilerOptions: {
			module: ts.ModuleKind.CommonJS,
			target: ts.ScriptTarget.ES2020,
			esModuleInterop: true,
			isolatedModules: true,
		},
	});
	const diagnostic = (output.diagnostics || [])[0];

	if (diagnostic) {
		throw new Error(`${name}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')}`);
	}

	// The module object is cached, not its exports, so a cycle sees the current `module.exports`.
	const module = { exports: {} };

	cache.set(file, module);
	const shimRequire = (specifier) => {
		if (PLUGIN_NAMES.includes(specifier)) {
			return { definePreferences: (definition) => definition };
		}

		if (RELATIVE.test(specifier)) {
			const base = path.resolve(path.dirname(file), specifier);
			const target = EXTENSIONS.map((extension) => base + extension).find(
				(candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile(),
			);

			if (!target) {
				throw new Error(`${name}: cannot find "${specifier}". Relative imports must point at a .ts or .js file.`);
			}

			return evaluate(target, projectDir, ts, cache, options);
		}

		if (options && options.config) {
			// nativescript.config.ts may use Node itself; anything else only has to not crash.
			const bare = specifier.startsWith('node:') ? specifier.slice(5) : specifier;

			return NODE_BUILTINS.has(bare) ? require(bare) : {};
		}

		throw new Error(
			`${name} runs in Node at build time and cannot import "${specifier}". Keep it self-contained: import only this package and relative .ts or .js helpers.`,
		);
	};

	try {
		vm.runInThisContext(Module.wrap(output.outputText), { filename: file })(
			module.exports,
			shimRequire,
			module,
			file,
			path.dirname(file),
		);
	} catch (error) {
		cache.delete(file);
		if (error instanceof SyntaxError) {
			throw new Error(
				`${name}: ${error.message}. The file runs in Node at build time; use plain imports and exports, no import.meta or top-level await.`,
				{ cause: error },
			);
		}

		throw error;
	}

	return module.exports;
}

/**
 * Returns the plain definition object exported by `file`: the `export default definePreferences({...})`
 * of a TypeScript or ES module, or `module.exports` of a CommonJS one. `options.typescriptPaths`
 * pins where `typescript` is looked up (tests only).
 */
function loadDefinition(file, options = {}) {
	const projectDir = path.resolve(options.projectDir || path.dirname(file));
	const exports = evaluate(
		path.resolve(file),
		projectDir,
		findTypescript(projectDir, options.typescriptPaths),
		new Map(),
	);
	const candidate = exports && typeof exports === 'object' && 'default' in exports ? exports.default : exports;

	if (!candidate || typeof candidate !== 'object' || !Array.isArray(candidate.items)) {
		throw new Error(`${relative(projectDir, file)} must \`export default definePreferences({ items: [...] })\`.`);
	}

	return candidate;
}

/**
 * Finds the definition to build from. An explicit `config` wins. Otherwise the first of
 * `<appDir>/app.preferences.ts`, `<appDir>/app.preferences.js`, the same two in the project root,
 * and `preferences.json` in the project root. More than one present is an error, so two sources
 * can never disagree.
 */
function findDefinition({ projectDir, appDir, config }) {
	projectDir = path.resolve(projectDir);
	if (config) {
		return path.resolve(projectDir, config);
	}

	const dirs = [];

	if (appDir) {
		dirs.push(path.resolve(projectDir, appDir));
	}

	dirs.push(projectDir);
	const candidates = [];

	for (const dir of dirs) {
		for (const name of DEFINITION_FILES) {
			candidates.push(path.join(dir, name));
		}
	}

	candidates.push(path.join(projectDir, JSON_FILE));
	const present = Array.from(new Set(candidates)).filter((file) => fs.existsSync(file));

	if (present.length > 1) {
		throw new Error(
			`found more than one preferences definition: ${present.map((file) => relative(projectDir, file)).join(', ')}. Keep one, or pass --config.`,
		);
	}

	return present[0];
}

/**
 * The app directory the CLI would use: `appPath` from nativescript.config.ts / .js, else `src`
 * when it exists, else `app`. The config is read with the same loader; Node built-ins work in it
 * and any other bare import yields `{}`, since only `appPath` is needed. A config that cannot be
 * evaluated is an error naming `--app-dir`, never a guess.
 */
function resolveAppDir(projectDir) {
	projectDir = path.resolve(projectDir);
	const configFile = ['nativescript.config.ts', 'nativescript.config.js']
		.map((name) => path.join(projectDir, name))
		.find((file) => fs.existsSync(file));

	if (configFile) {
		let config;

		try {
			const exports = evaluate(configFile, projectDir, findTypescript(projectDir), new Map(), { config: true });

			config = exports && typeof exports === 'object' && 'default' in exports ? exports.default : exports;
		} catch (error) {
			throw new Error(
				`could not read ${path.basename(configFile)} to find appPath (${error.message}). Pass --app-dir <dir>.`,
				{ cause: error },
			);
		}

		if (config && typeof config.appPath === 'string' && config.appPath) {
			return path.resolve(projectDir, config.appPath);
		}
	}

	return fs.existsSync(path.join(projectDir, 'src')) && !fs.existsSync(path.join(projectDir, 'app'))
		? path.join(projectDir, 'src')
		: path.join(projectDir, 'app');
}

module.exports = { DEFINITION_FILES, JSON_FILE, PLUGIN_NAMES, loadDefinition, findDefinition, resolveAppDir };
