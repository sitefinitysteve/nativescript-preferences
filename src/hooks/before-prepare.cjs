'use strict';

/**
 * NativeScript CLI hook. Regenerates the platform preference files from `preferences.json`
 * before every prepare, so the OS settings UI always matches the JSON.
 *
 * Register it in nativescript.config.ts:
 *
 *   hooks: [{ type: 'before-prepare', script: 'node_modules/nativescript-preferences/hooks/before-prepare.cjs' }]
 *
 * The hook is a no-op for projects without a preferences.json.
 */

const fs = require('fs');
const path = require('path');
const generator = require('../generator/index.cjs');

module.exports = function (hookArgs) {
	const projectData = (hookArgs && hookArgs.projectData) || {};
	const prepareData = (hookArgs && hookArgs.prepareData) || {};
	const projectDir = projectData.projectDir || process.cwd();
	const configFile = path.join(projectDir, generator.DEFAULT_CONFIG_FILE);
	if (!fs.existsSync(configFile)) {
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
};
