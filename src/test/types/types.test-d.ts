/**
 * Compile-time assertions for `definePreferences()`. Run by `npm test` through
 * `tsc -p test/types/tsconfig.json`; a wrong inference or a missing error fails the build.
 */
import { definePreferences, PreferencesDefinition } from '../../index';

// ---- inference from a literal, mirroring the demo shape ----
const settings = definePreferences({
	title: 'Waveform',
	items: [
		{
			type: 'group',
			title: 'Appearance',
			items: [
				{
					key: 'theme',
					type: 'list',
					title: 'Theme',
					default: 'system',
					options: [{ value: 'system', title: 'Follow system' }, 'light', 'dark'],
				},
				{ key: 'accent', type: 'list', title: 'Accent', default: 'indigo', options: ['indigo', 'sunset'] },
				{ key: 'compact_rows', type: 'toggle', title: 'Compact rows', default: false },
				{ key: 'text_size', type: 'slider', title: 'Text size', default: 16, min: 12, max: 24 },
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
					items: [
						{ key: 'sync_interval', type: 'list', title: 'Check', default: '60', options: ['15', '60', '360'] },
						{ key: 'notify_topics', type: 'multilist', title: 'Topics', default: ['a'], options: ['a', 'b'] },
						{ key: 'display_name', type: 'text', title: 'Name' },
						{
							type: 'screen',
							key: 'diagnostics',
							title: 'Diagnostics',
							items: [{ type: 'group', items: [{ key: 'analytics', type: 'toggle', title: 'Analytics' }] }],
						},
					],
				},
			],
		},
	],
});

const theme: 'system' | 'light' | 'dark' = settings.get('theme');
const accent: 'indigo' | 'sunset' = settings.get('accent');
const sync: '15' | '60' | '360' = settings.get('sync_interval');
const compact: boolean = settings.get('compact_rows');
const size: number = settings.get('text_size');
const topics: string[] = settings.get('notify_topics');
const name: string = settings.get('display_name');
const analytics: boolean = settings.get('analytics');
const title: string | undefined = settings.definition.title;

settings.set('theme', 'dark');
settings.set('accent', null);
settings.onChange('theme', (value: 'system' | 'light' | 'dark') => value);
// @ts-expect-error wrong literal
settings.set('theme', 'blue');
// @ts-expect-error a sibling list's union does not leak across keys
settings.set('accent', 'dark');
// @ts-expect-error label keys are not stored
settings.get('plan');
// @ts-expect-error unknown key
settings.get('nope');
// @ts-expect-error a list value is not a boolean
const wrong: boolean = settings.get('theme');

// ---- defaults are checked against options, reported on the items array ----
definePreferences({
	// @ts-expect-error list default not in options
	items: [{ key: 'theme', type: 'list', title: 'Theme', default: 'nope', options: ['system', 'light'] }],
});
definePreferences({
	// @ts-expect-error multilist default not in options
	items: [{ key: 't', type: 'multilist', title: 'T', default: ['zzz'], options: ['a', 'b'] }],
});
definePreferences({
	// @ts-expect-error a list needs a default
	items: [{ key: 'x', type: 'list', title: 'X', options: ['a', 'b'] }],
});
definePreferences({
	// @ts-expect-error nested defaults are checked too
	items: [
		{
			type: 'screen',
			key: 's',
			title: 'S',
			items: [{ key: 'deep', type: 'list', title: 'D', default: 'c', options: ['a', 'b'] }],
		},
	],
});

// ---- misspelled and unknown properties are errors ----
definePreferences({
	// @ts-expect-error `titel`
	items: [{ key: 'x', type: 'toggle', titel: 'X' }],
});
definePreferences({
	// @ts-expect-error `defualt` on a nested item
	items: [{ type: 'group', title: 'G', items: [{ key: 'x', type: 'slider', defualt: 3 }] }],
});
definePreferences({
	// @ts-expect-error a group cannot contain a group
	items: [{ type: 'group', title: 'G', items: [{ type: 'group', title: 'H', items: [] }] }],
});
// @ts-expect-error unknown top-level property
definePreferences({ titel: 'x', items: [] });

// ---- unknown properties in output and option objects ----
definePreferences({
	// @ts-expect-error `andriod` is not an output option
	output: { android: false, andriod: false },
	items: [],
});
definePreferences({
	// @ts-expect-error `titel` on an option object
	items: [{ key: 'k', type: 'list', title: 'K', default: 'a', options: [{ value: 'a', titel: 'A' }] }],
});

// ---- ten screens deep still infers (no depth cap) ----
const tenDeep = definePreferences({
	items: [
		{
			type: 'screen',
			key: 's1',
			title: '1',
			items: [
				{
					type: 'screen',
					key: 's2',
					title: '2',
					items: [
						{
							type: 'screen',
							key: 's3',
							title: '3',
							items: [
								{
									type: 'screen',
									key: 's4',
									title: '4',
									items: [
										{
											type: 'screen',
											key: 's5',
											title: '5',
											items: [
												{
													type: 'screen',
													key: 's6',
													title: '6',
													items: [
														{
															type: 'screen',
															key: 's7',
															title: '7',
															items: [
																{
																	type: 'screen',
																	key: 's8',
																	title: '8',
																	items: [
																		{
																			type: 'screen',
																			key: 's9',
																			title: '9',
																			items: [
																				{
																					type: 'screen',
																					key: 's10',
																					title: '10',
																					items: [{ key: 'bottom', type: 'toggle', title: 'Bottom', default: true }],
																				},
																			],
																		},
																	],
																},
															],
														},
													],
												},
											],
										},
									],
								},
							],
						},
					],
				},
			],
		},
	],
});
const bottom: boolean = tenDeep.get('bottom');

// ---- a widened definition still type-checks and yields the untyped schema ----
const wide: PreferencesDefinition = { items: [{ key: 'anything', type: 'text', title: 'A' }] };
const loose = definePreferences(wide);
const looseValue: string | number | boolean | string[] | undefined = loose.get('anything');

// ---- readonly arrays and a helper constant work without `as const` on the call ----
const OPTIONS = ['x', 'y'] as const;
const fromConst = definePreferences({
	items: [{ key: 'k', type: 'list', title: 'K', default: 'x', options: OPTIONS }],
});
const k: 'x' | 'y' = fromConst.get('k');

export { theme, accent, sync, compact, size, topics, name, analytics, title, wrong, looseValue, k, bottom };
