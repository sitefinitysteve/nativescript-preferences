'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

// index.ios.ts needs the iOS runtime, so read the pattern out of the source instead of importing it.
const source = fs.readFileSync(path.join(__dirname, '..', 'index.ios.ts'), 'utf8');
const match = source.match(/export const systemKeyPattern = (\/.*\/[a-z]*);/);
assert.ok(match, 'systemKeyPattern not found in index.ios.ts');
const systemKeyPattern = new Function(`return ${match[1]}`)();

test('systemKeyPattern matches the keys iOS writes into the app domain', () => {
	for (const key of ['NSHyphenatesAsLastResort', 'AppleLanguages', 'MultiWindowEnabled', 'WebKitDefaultFontSize', 'com.apple.something', 'AKLastIDMSEnvironment']) {
		assert.ok(systemKeyPattern.test(key), `${key} should be filtered`);
	}
});

test('systemKeyPattern leaves app preference keys alone', () => {
	for (const key of ['theme', 'enabled', 'volume', 'name', 'multi_window', 'apple_pay_enabled', 'notes']) {
		assert.ok(!systemKeyPattern.test(key), `${key} should not be filtered`);
	}
});
