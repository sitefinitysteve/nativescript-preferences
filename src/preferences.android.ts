import * as app from 'tns-core-modules/application/application';
import * as frameModule from 'tns-core-modules/ui/frame/frame';
import { Common } from './preferences.common';
import { SettingsFragment } from './settingsfragment'

declare var com;

export class Preferences extends Common {
    private _prefsKey: string = "SettingsBundle";

    public setValue(key: string, value: any) {
        this.getPreferences().edit().putString(key, value).commit();
    }

    public getValue(key: string): any {
        return this.getPreferences().getString(key, "");
    }

    public openSettings() {
        debugger;
        var activity = frameModule.topmost().android.activity;
        
        var intent = new android.content.Intent(activity, com.sitefinitysteve.nativescriptsettings.NativescriptSettingsActivity.class);
        activity.startActivity(intent);
    }


    private getPreferences(): any {
        return app.android.context.getSharedPreferences(this._prefsKey, 0);
    }
}

