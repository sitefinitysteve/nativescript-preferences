/**
 * The shape `definePreferences()` accepts, and the types it infers from it.
 *
 * Everything here is `readonly` so a definition written inline keeps its literal types under the
 * `const` type parameter without `as const`. Requires TypeScript 6 (NativeScript 9's version; 5.3 is the floor).
 */

/** A `list` / `multilist` option: a value that doubles as its title, or `{ value, title }`. */
export type PreferenceOption = string | { readonly value: string; readonly title?: string };

/** The stored value of one option. */
export type PreferenceOptionValue<O> = O extends string
	? O
	: O extends { readonly value: infer V extends string }
		? V
		: never;

/**
 * Per-platform override. `false` hides the item on that platform. `widget` swaps the control; any
 * other entry is written verbatim as a plist key or XML attribute, and `null` removes one.
 */
export type PreferencePlatformOverride =
	| false
	| Readonly<Record<string, string | number | boolean | readonly string[] | null>>;

interface PreferenceItemBase {
	/** Unique key, letters, digits and underscore. Becomes the `NSUserDefaults` / `SharedPreferences` key. */
	readonly key: string;
	readonly title?: string;
	/** Android shows it under the title. iOS shows only a group's summary, as footer text. */
	readonly summary?: string;
	readonly ios?: PreferencePlatformOverride;
	readonly android?: PreferencePlatformOverride;
}

export interface TextPreferenceItem extends PreferenceItemBase {
	readonly type: 'text';
	/** Defaults to `''`. */
	readonly default?: string;
	readonly placeholder?: string;
	readonly secure?: boolean;
	readonly keyboard?: 'default' | 'email' | 'number' | 'decimal' | 'phone' | 'url';
	/** iOS only. */
	readonly autocapitalize?: 'none' | 'sentences' | 'words' | 'characters';
	/** iOS only. */
	readonly autocorrect?: boolean;
}

export interface TogglePreferenceItem extends PreferenceItemBase {
	readonly type: 'toggle';
	/** Defaults to `false`. */
	readonly default?: boolean;
}

export interface ListPreferenceItem extends PreferenceItemBase {
	readonly type: 'list';
	readonly options: readonly PreferenceOption[];
	/** Required, and checked against `options` at compile time. */
	readonly default: string;
}

export interface MultiListPreferenceItem extends PreferenceItemBase {
	readonly type: 'multilist';
	readonly options: readonly PreferenceOption[];
	/** Defaults to `[]`. Checked against `options` at compile time. */
	readonly default?: readonly string[];
}

export interface SliderPreferenceItem extends PreferenceItemBase {
	readonly type: 'slider';
	/** Whole numbers only. Defaults to `min`. */
	readonly default?: number;
	/** Defaults to 0. */
	readonly min?: number;
	/** Defaults to 100. */
	readonly max?: number;
	readonly step?: number;
}

/** A read-only row. Stores nothing and has no key in the inferred schema. */
export interface LabelPreferenceItem extends PreferenceItemBase {
	readonly type: 'label';
	readonly title: string;
	readonly value?: string;
}

/** A titled section. Cannot contain another group; nest with a `screen`. */
export interface GroupPreferenceItem {
	readonly type: 'group';
	readonly title?: string;
	readonly summary?: string;
	readonly ios?: PreferencePlatformOverride;
	readonly android?: PreferencePlatformOverride;
	readonly items: readonly Exclude<PreferenceItem, GroupPreferenceItem>[];
}

/** A nested screen: a child pane on iOS, a nested `PreferenceScreen` on Android. */
export interface ScreenPreferenceItem extends PreferenceItemBase {
	readonly type: 'screen';
	readonly title: string;
	readonly items: readonly PreferenceItem[];
}

export type PreferenceItem =
	| TextPreferenceItem
	| TogglePreferenceItem
	| ListPreferenceItem
	| MultiListPreferenceItem
	| SliderPreferenceItem
	| LabelPreferenceItem
	| GroupPreferenceItem
	| ScreenPreferenceItem;

export interface PreferencesOutput {
	/** `Settings.bundle` directory, relative to the project. `false` to stop generating it. */
	readonly ios?: string | false;
	/** Android `res` directory, relative to the project. `false` to stop generating it. */
	readonly android?: string | false;
	/** Name of the generated `res/xml/<name>.xml` and its string arrays. Defaults to `preferences`. */
	readonly androidResource?: string;
}

export interface PreferencesDefinition {
	readonly title?: string;
	readonly output?: PreferencesOutput;
	readonly items: readonly PreferenceItem[];
}

// Inference -----------------------------------------------------------------------------------------

/**
 * Every item nested under `I`, flattened. A literal definition is finite, so recursion ends on its
 * own; widened input (the whole `PreferenceItem` union) is returned as is, which yields the untyped
 * schema instead of recursing into the self-referential union.
 */
type FlattenPreferenceItems<I> = [PreferenceItem] extends [I]
	? I
	: I extends { readonly items: readonly (infer C)[] }
		? FlattenPreferenceItems<C>
		: I;

type ItemsOf<D> = D extends { readonly items: readonly (infer I)[] } ? I : never;

type StoringType = 'text' | 'toggle' | 'list' | 'multilist' | 'slider';

/** The items of a definition that store a value, with nested groups and screens flattened. */
export type StoredPreferenceItems<D> = Extract<
	FlattenPreferenceItems<ItemsOf<D>>,
	{ readonly key: string; readonly type: StoringType }
>;

/** The value type one stored item holds. */
export type PreferenceItemValue<I> = I extends { readonly type: 'text' }
	? string
	: I extends { readonly type: 'toggle' }
		? boolean
		: I extends { readonly type: 'slider' }
			? number
			: I extends { readonly type: 'multilist' }
				? string[]
				: I extends { readonly type: 'list'; readonly options: readonly (infer O)[] }
					? PreferenceOptionValue<O>
					: never;

/** The schema `definePreferences()` infers: one property per stored key, typed by its item. */
export type InferPreferences<D> = {
	[K in StoredPreferenceItems<D>['key']]: PreferenceItemValue<Extract<StoredPreferenceItems<D>, { readonly key: K }>>;
};

// Validation ----------------------------------------------------------------------------------------

/** Makes a property that is not part of `Known` a type error, since intersections skip excess property checks. */
type NoExtraKeys<I, Known> = { readonly [K in keyof I as K extends keyof Known ? never : K]?: never };

/** An option literal with its properties checked: a string, or `{ value, title }` and nothing else. */
type ValidatePreferenceOption<O> = O extends string
	? O
	: O & NoExtraKeys<O, { readonly value: string; readonly title?: string }>;

/** Narrows `default` to the item's own options and rejects unknown properties, recursively. */
export type ValidatePreferenceItem<I> = I extends { readonly type: 'list'; readonly options: readonly (infer O)[] }
	? Omit<I, 'default' | 'options'> & {
			readonly default: PreferenceOptionValue<O>;
			readonly options: readonly ValidatePreferenceOption<O>[];
		} & NoExtraKeys<I, ListPreferenceItem>
	: I extends { readonly type: 'multilist'; readonly options: readonly (infer O)[] }
		? Omit<I, 'default' | 'options'> & {
				readonly default?: readonly PreferenceOptionValue<O>[];
				readonly options: readonly ValidatePreferenceOption<O>[];
			} & NoExtraKeys<I, MultiListPreferenceItem>
		: I extends { readonly type: 'group'; readonly items: readonly (infer C)[] }
			? Omit<I, 'items'> & { readonly items: readonly ValidatePreferenceItem<C>[] } & NoExtraKeys<
						I,
						GroupPreferenceItem
					>
			: I extends { readonly type: 'screen'; readonly items: readonly (infer C)[] }
				? Omit<I, 'items'> & { readonly items: readonly ValidatePreferenceItem<C>[] } & NoExtraKeys<
							I,
							ScreenPreferenceItem
						>
				: I extends { readonly type: 'text' }
					? I & NoExtraKeys<I, TextPreferenceItem>
					: I extends { readonly type: 'toggle' }
						? I & NoExtraKeys<I, TogglePreferenceItem>
						: I extends { readonly type: 'slider' }
							? I & NoExtraKeys<I, SliderPreferenceItem>
							: I extends { readonly type: 'label' }
								? I & NoExtraKeys<I, LabelPreferenceItem>
								: I;

/** The parameter type of `definePreferences()`: the definition, with defaults and property names checked. */
/** `output` with its property names checked; absent or widened input passes through. */
type ValidatePreferencesOutput<O> = O extends object ? O & NoExtraKeys<O, PreferencesOutput> : O;

export type ValidatePreferencesDefinition<D> = Omit<D, 'items' | 'output'> & {
	readonly items: readonly ValidatePreferenceItem<ItemsOf<D>>[];
	readonly output?: D extends { readonly output?: infer O } ? ValidatePreferencesOutput<O> : never;
} & NoExtraKeys<D, PreferencesDefinition>;
