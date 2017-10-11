import * as app from 'tns-core-modules/application/application';
import { Common } from './preferences.common';

export class Preferences extends Common {
    private _prefsKey: string = "SettingsBundle";

    public setValue(key: string, value: any) {
        this.getPreferences().edit().putString(key, value).commit();
    }

    public getValue(key: string): any {
        return this.getPreferences().getString(key, "");
    }

    private getPreferences(): any {
        return app.android.context.getSharedPreferences(this._prefsKey, 0);
    }
}
