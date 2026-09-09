import { definePreferences } from 'nativescript-preferences';

/**
 * Every setting in the demo, declared once. Keys and value types are inferred from this file, and
 * the build hook regenerates App_Resources/iOS/Settings.bundle and res/xml/preferences.xml from it.
 * Keep it self-contained: import only nativescript-preferences and relative .ts helpers here.
 */
export default definePreferences({
	title: 'Waveform settings',
	items: [
		{
			type: 'group',
			title: 'Account',
			summary: 'Signed in on this device.',
			items: [
				{
					key: 'display_name',
					type: 'text',
					title: 'Name',
					default: 'Steve McNiven',
					autocapitalize: 'words',
					autocorrect: false,
				},
				{
					key: 'email',
					type: 'text',
					title: 'Email',
					default: 'steve@waveform.fm',
					keyboard: 'email',
					autocapitalize: 'none',
					autocorrect: false,
				},
				{
					key: 'plan',
					type: 'label',
					title: 'Plan',
					value: 'Waveform Pro',
				},
			],
		},
		{
			type: 'group',
			title: 'Appearance',
			items: [
				{
					key: 'accent',
					type: 'list',
					title: 'Accent',
					default: 'indigo',
					options: [
						{
							value: 'indigo',
							title: 'Indigo',
						},
						{
							value: 'sunset',
							title: 'Sunset',
						},
						{
							value: 'forest',
							title: 'Forest',
						},
						{
							value: 'graphite',
							title: 'Graphite',
						},
					],
				},
				{
					key: 'compact_rows',
					type: 'toggle',
					title: 'Compact rows',
					summary: 'Fit more episodes on screen',
					default: false,
				},
				{
					key: 'theme',
					type: 'list',
					title: 'Theme',
					default: 'system',
					options: [
						{
							value: 'system',
							title: 'Follow system',
						},
						{
							value: 'light',
							title: 'Light',
						},
						{
							value: 'dark',
							title: 'Dark',
						},
					],
					ios: {
						widget: 'PSRadioGroupSpecifier',
					},
					android: {
						widget: 'DropDownPreference',
						'android:icon': '@drawable/ic_pref_theme',
					},
				},
			],
		},
		{
			type: 'group',
			title: 'Text size',
			summary: 'Applies to show notes and transcripts.',
			items: [
				{
					key: 'text_size',
					type: 'slider',
					title: 'Text size',
					default: 16,
					min: 12,
					max: 24,
					step: 1,
					android: {
						'app:showSeekBarValue': true,
					},
				},
			],
		},
		{
			type: 'group',
			title: 'Playback',
			items: [
				{
					key: 'playback_speed',
					type: 'list',
					title: 'Speed',
					default: '1.0',
					options: [
						{
							value: '0.75',
							title: '0.75×',
						},
						{
							value: '1.0',
							title: 'Normal',
						},
						{
							value: '1.25',
							title: '1.25×',
						},
						{
							value: '1.5',
							title: '1.5×',
						},
						{
							value: '2.0',
							title: '2×',
						},
					],
				},
				{
					key: 'skip_silence',
					type: 'toggle',
					title: 'Skip silence',
					summary: 'Trim long pauses while playing',
					default: true,
				},
				{
					key: 'continuous_play',
					type: 'toggle',
					title: 'Play next automatically',
					default: true,
				},
			],
		},
		{
			type: 'group',
			title: 'Notifications',
			summary: 'Waveform only notifies you about the topics you pick.',
			items: [
				{
					key: 'notifications_enabled',
					type: 'toggle',
					title: 'Allow notifications',
					default: true,
				},
				{
					key: 'notify_topics',
					type: 'multilist',
					title: 'Notify me about',
					default: ['episodes', 'replies'],
					options: [
						{
							value: 'episodes',
							title: 'New episodes',
						},
						{
							value: 'replies',
							title: 'Replies to me',
						},
						{
							value: 'mentions',
							title: 'Mentions',
						},
						{
							value: 'digest',
							title: 'Weekly digest',
						},
					],
					ios: false,
				},
				{
					key: 'alert_sound',
					type: 'list',
					title: 'Alert sound',
					default: 'chime',
					options: [
						{
							value: 'chime',
							title: 'Chime',
						},
						{
							value: 'pulse',
							title: 'Pulse',
						},
						{
							value: 'none',
							title: 'Silent',
						},
					],
				},
			],
		},
		{
			type: 'screen',
			key: 'advanced_screen',
			title: 'Advanced',
			summary: 'Sync, downloads and diagnostics',
			android: {
				'android:icon': '@drawable/ic_pref_advanced',
			},
			items: [
				{
					type: 'group',
					title: 'Sync',
					items: [
						{
							key: 'sync_on_cellular',
							type: 'toggle',
							title: 'Sync on cellular',
							summary: 'Otherwise wait for Wi-Fi',
							default: false,
						},
						{
							key: 'sync_interval',
							type: 'list',
							title: 'Check for new episodes',
							default: '60',
							options: [
								{
									value: '15',
									title: 'Every 15 minutes',
								},
								{
									value: '60',
									title: 'Every hour',
								},
								{
									value: '360',
									title: 'Every 6 hours',
								},
								{
									value: '0',
									title: 'Only when I open the app',
								},
							],
						},
					],
				},
				{
					type: 'group',
					title: 'Downloads',
					items: [
						{
							key: 'download_quality',
							type: 'list',
							title: 'Quality',
							default: 'high',
							options: [
								{
									value: 'low',
									title: 'Data saver',
								},
								{
									value: 'high',
									title: 'High',
								},
								{
									value: 'lossless',
									title: 'Lossless',
								},
							],
						},
						{
							key: 'delete_after',
							type: 'list',
							title: 'Delete played episodes',
							default: '7',
							options: [
								{
									value: '0',
									title: 'Immediately',
								},
								{
									value: '7',
									title: 'After a week',
								},
								{
									value: '30',
									title: 'After a month',
								},
								{
									value: 'never',
									title: 'Never',
								},
							],
						},
					],
				},
				{
					type: 'group',
					title: 'Storage limit',
					summary: 'Waveform removes the oldest downloads first.',
					items: [
						{
							key: 'storage_limit_gb',
							type: 'slider',
							title: 'Storage limit (GB)',
							default: 8,
							min: 1,
							max: 50,
							android: {
								'app:showSeekBarValue': true,
							},
						},
					],
				},
				{
					type: 'group',
					items: [
						{
							type: 'screen',
							key: 'diagnostics_screen',
							title: 'Diagnostics',
							summary: 'Reporting and logs',
							items: [
								{
									type: 'group',
									title: 'Reporting',
									summary: 'Reports never include the contents of your library.',
									items: [
										{
											key: 'analytics',
											type: 'toggle',
											title: 'Share anonymous analytics',
											default: false,
										},
										{
											key: 'crash_reports',
											type: 'toggle',
											title: 'Send crash reports',
											default: true,
										},
									],
								},
								{
									type: 'group',
									title: 'Logging',
									items: [
										{
											key: 'log_level',
											type: 'list',
											title: 'Log level',
											default: 'warn',
											options: [
												{
													value: 'error',
													title: 'Errors only',
												},
												{
													value: 'warn',
													title: 'Warnings',
												},
												{
													value: 'info',
													title: 'Info',
												},
												{
													value: 'debug',
													title: 'Debug',
												},
											],
										},
									],
								},
								{
									type: 'group',
									title: 'About',
									items: [
										{
											key: 'app_version',
											type: 'label',
											title: 'Version',
											value: '2.0.0',
										},
										{
											key: 'build_number',
											type: 'label',
											title: 'Build',
											value: '2026.09.1',
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
