#!/usr/bin/env node
'use strict';

/**
 * Prints the CHANGELOG.md section for one version, for use as GitHub release notes.
 *
 *   node scripts/release-notes.cjs 2.0.0            # from the "## 2.0.0" heading to the next "## "
 *   node scripts/release-notes.cjs v2.0.0 > notes.md
 */

const fs = require('fs');
const path = require('path');

const version = (process.argv[2] || '').replace(/^v/, '');
if (!version) {
	console.error('Usage: node scripts/release-notes.cjs <version>');
	process.exit(2);
}

const changelog = fs.readFileSync(path.join(__dirname, '..', 'CHANGELOG.md'), 'utf8');
const lines = changelog.split('\n');
const start = lines.findIndex((line) => line.trim() === `## ${version}`);
if (start === -1) {
	console.error(`CHANGELOG.md has no "## ${version}" section.`);
	process.exit(1);
}
let end = lines.findIndex((line, index) => index > start && line.startsWith('## '));
if (end === -1) {
	end = lines.length;
}
process.stdout.write(lines.slice(start + 1, end).join('\n').trim() + '\n');
