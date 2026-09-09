'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const { test } = require('node:test');

const generator = require('../generator/index.cjs');

// The runtime derives defaults in define.ts; the generator derives them in normalizeItem. They are
// written twice on purpose (the generator is CJS, the runtime is ESM), so this pins them together.

const definition = {
	items: [
		{
			type: 'group',
			title: 'All types, defaults omitted where allowed',
			items: [
				{ key: 'text_omitted', type: 'text', title: 'Text' },
				{ key: 'text_set', type: 'text', title: 'Text', default: 'hello' },
				{ key: 'toggle_omitted', type: 'toggle', title: 'Toggle' },
				{ key: 'toggle_set', type: 'toggle', title: 'Toggle', default: true },
				{ key: 'list_set', type: 'list', title: 'List', default: 'b', options: ['a', { value: 'b', title: 'B' }] },
				{ key: 'multi_omitted', type: 'multilist', title: 'Multi', options: ['a', 'b'] },
				{ key: 'multi_set', type: 'multilist', title: 'Multi', default: ['b'], options: ['a', 'b'] },
				{ key: 'slider_omitted', type: 'slider', title: 'Slider' },
				{ key: 'slider_min', type: 'slider', title: 'Slider', min: 5, max: 10 },
				{ key: 'slider_set', type: 'slider', title: 'Slider', default: 7, min: 5, max: 10 },
				{ key: 'label', type: 'label', title: 'Label', value: 'x' },
			],
		},
		{
			type: 'screen',
			key: 'nested',
			title: 'Nested',
			items: [{ key: 'deep', type: 'toggle', title: 'Deep', default: true }],
		},
	],
};

function collect(items, out = {}) {
	for (const item of items) {
		if (item.items) {
			collect(item.items, out);
		} else if (item.type !== 'label') {
			out[item.key] = item.default;
		}
	}
	return out;
}

test('define.ts derives the same defaults and integer keys as the generator', async () => {
	const { toPreferencesOptions } = await import(path.join(__dirname, '..', 'define.js'));
	const runtime = toPreferencesOptions(definition);
	const generated = generator.normalizeConfig(definition, { source: 'app.preferences.ts' });
	assert.deepEqual(runtime.defaults, collect(generated.items));
	assert.deepEqual(runtime.integers, ['slider_omitted', 'slider_min', 'slider_set']);
	assert.equal(runtime.definition, definition);
	assert.ok(!('label' in runtime.defaults));
});

test('define.ts requires a default for a list, like the generated module does', async () => {
	const { toPreferencesOptions } = await import(path.join(__dirname, '..', 'define.js'));
	assert.throws(
		() => toPreferencesOptions({ items: [{ key: 'theme', type: 'list', title: 'T', options: ['a'] }] }),
		/list "theme" needs a default/,
	);
});
