import * as app from 'tns-core-modules/application/application';
import * as frameModule from 'tns-core-modules/ui/frame/frame';
import { Common } from './preferences.common';
import { SettingsFragment } from './settingsfragment'

declare var com;

export class Preferences extends Common {
    public setValue(key: string, value: any) {
        var allPrefs = this.getPreferences().getAll();
        var pref = allPrefs.get(key);

        if (pref instanceof java.lang.String) {
            this.getPreferences().edit().putString(key, value).commit();
        } else if (pref instanceof java.lang.Boolean) {
            this.getPreferences().edit().putBoolean(key, value).commit();
        }
    }

    public getValue(key: string, defaultValue?: any): any {
        debugger;
        var allPrefs = this.getPreferences().getAll();
        var pref = allPrefs.get(key);
        
        if (pref instanceof java.lang.Boolean) {
            if (!defaultValue)
                defaultValue = false;
            
            return this.getPreferences().getBoolean(key, defaultValue);
        } else {
            //Fallback to assuming string, because ¯\_(ツ)_/¯
            if (!defaultValue)
                defaultValue = "";

            return this.getPreferences().getString(key, defaultValue);
        }
    }

    public openSettings() {
        debugger;
        var activity = frameModule.topmost().android.activity;
        
        var intent = new android.content.Intent(activity, com.sitefinitysteve.nativescriptsettings.NativescriptSettingsActivity.class);
        activity.startActivity(intent);
    }


    private getPreferences(): any {
        var context = getContext();
        return android.preference.PreferenceManager.getDefaultSharedPreferences(context)
    }
}

//Thx @NathanaelA
function getContext() {
    var ctx = java.lang.Class.forName("android.app.AppGlobals").getMethod("getInitialApplication", null).invoke(null, null);
    if (ctx) { return ctx; }

    return java.lang.Class.forName("android.app.ActivityThread").getMethod("currentApplication", null).invoke(null, null);
}