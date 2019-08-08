import * as app from 'tns-core-modules/application/application';
import * as frameModule from 'tns-core-modules/ui/frame/frame';
import { Common } from './preferences.common';

declare var com;

export class Preferences extends Common {
    public setValue(key: string, value: any) {
        var allPrefs = this.getPreferences().getAll();
        var pref = allPrefs.get(key);

        debugger;
        if (typeof pref === "string") {
            this.getPreferences().edit().putString(key, value).commit();
        }
        else if (pref instanceof java.lang.Boolean) {
            this.getPreferences().edit().putBoolean(key, value).commit();
        }
        else if (typeof pref === "number") {
            this.getPreferences().edit().putInt(key, value).commit();
        }
    }

    public getValue(key: string, defaultValue?: any): any {
        
        var allPrefs = this.getPreferences().getAll();
        var pref = allPrefs.get(key);

        debugger;
        if (typeof pref === "string") {
            if (!defaultValue)
                defaultValue = "";

            return this.getPreferences().getString(key, defaultValue);
        } 
        else if (pref instanceof java.lang.Boolean) {
            if (!defaultValue)
                defaultValue = false;
            
            return this.getPreferences().getBoolean(key, defaultValue);
        } 
        else if (typeof pref === "number") {
            if (!defaultValue)
                defaultValue = 0;

            return this.getPreferences().getInt(key, defaultValue);
        } 

        //Fallback to assuming string, because ¯\_(ツ)_/¯
        return null;
    }

    public clear() {
        this.getPreferences().edit().clear().commit();
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
