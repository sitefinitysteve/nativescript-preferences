'use strict';

/**
 * NativeScript CLI hook. Regenerates the platform preference files from `preferences.json`
 * before every prepare, so the OS settings UI always matches the JSON.
 *
 * Register it in nativescript.config.ts:
 *
 *   hooks: [{ type: 'before-prepare', script: 'node_modules/nativescript-preferences/hooks/before-prepare.cjs' }]
 *
 * The hook is a no-op for projects without a preferences.json, and when NS_PREFERENCES_SKIP is set.
 * Files without the generated header are never overwritten; the hook reports them instead.
 */

const fs = require('fs');
const path = require('path');
const generator = require('../generator/index.cjs');

module.exports = function (hookArgs) {
	const projectData = (hookArgs && hookArgs.projectData) || {};
	const prepareData = (hookArgs && hookArgs.prepareData) || {};
	const projectDir = projectData.projectDir || process.cwd();
	const configFile = path.join(projectDir, generator.DEFAULT_CONFIG_FILE);
	if (!fs.existsSync(configFile) || isTruthy(process.env.NS_PREFERENCES_SKIP)) {
		return;
	}
	const platform = typeof prepareData.platform === 'string' ? prepareData.platform.toLowerCase() : undefined;
	const config = generator.loadConfig(configFile);
	const result = generator.generate(config, {
		projectDir,
		appResourcesDir: projectData.appResourcesDirectoryPath,
		platforms: platform === 'ios' || platform === 'android' ? [platform] : undefined,
	});
	for (const warning of result.warnings) {
		console.warn(`nativescript-preferences: ${warning}`);
	}
	for (const file of result.written.concat(result.removed)) {
		console.log(`nativescript-preferences: ${result.removed.includes(file) ? 'removed' : 'updated'} ${path.relative(projectDir, file)}`);
	}
	for (const file of result.skipped) {
		console.log(`nativescript-preferences: kept ${path.relative(projectDir, file)}, it has no generated header. Run "npx ns-preferences generate --force" to replace it, or set output.<platform> to false in preferences.json to stop generating it.`);
	}
};

function isTruthy(value) {
	return value !== undefined && value !== '' && value !== '0' && value.toLowerCase() !== 'false';
}
