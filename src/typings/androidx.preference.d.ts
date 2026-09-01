// Minimal ambient typings for androidx.preference (the artifact is not part of @nativescript/types).
// Only the members this plugin touches are declared.

declare namespace androidx {
	namespace preference {
		class PreferenceManager extends java.lang.Object {
			static getDefaultSharedPreferences(context: android.content.Context): android.content.SharedPreferences;
			static getDefaultSharedPreferencesName(context: android.content.Context): string;
			static setDefaultValues(context: android.content.Context, resId: number, readAgain: boolean): void;
			static setDefaultValues(context: android.content.Context, sharedPreferencesName: string, sharedPreferencesMode: number, resId: number, readAgain: boolean): void;
			getSharedPreferences(): android.content.SharedPreferences;
			setSharedPreferencesName(name: string): void;
			getSharedPreferencesName(): string;
		}

		class Preference extends java.lang.Object {
			getKey(): string;
			getTitle(): string;
			getSummary(): string;
		}

		class PreferenceGroup extends Preference {
			getPreferenceCount(): number;
			getPreference(index: number): Preference;
			findPreference(key: string): Preference;
		}

		class PreferenceScreen extends PreferenceGroup {}

		interface PreferenceFragmentCompatImplementation {
			onCreatePreferences(this: PreferenceFragmentCompat, savedInstanceState: android.os.Bundle, rootKey: string): void;
			onNavigateToScreen?(this: PreferenceFragmentCompat, preferenceScreen: PreferenceScreen): void;
			onDisplayPreferenceDialog?(this: PreferenceFragmentCompat, preference: Preference): void;
		}

		class PreferenceFragmentCompat extends androidx.fragment.app.Fragment {
			static extend(implementation: PreferenceFragmentCompatImplementation): { new (): PreferenceFragmentCompat };
			getPreferenceManager(): PreferenceManager;
			getPreferenceScreen(): PreferenceScreen;
			setPreferenceScreen(screen: PreferenceScreen): void;
			setPreferencesFromResource(resId: number, rootKey: string | null): void;
			addPreferencesFromResource(resId: number): void;
			findPreference(key: string): Preference;
			onCreatePreferences(savedInstanceState: android.os.Bundle, rootKey: string): void;
			onNavigateToScreen(preferenceScreen: PreferenceScreen): void;
			onDisplayPreferenceDialog(preference: Preference): void;
		}
	}
}
