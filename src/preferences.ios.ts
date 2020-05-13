import { Common } from './preferences.common';

declare var UIApplicationOpenSettingsURLString: any

export class Preferences extends Common {
    public setValue(key: string, value: any) {
        NSUserDefaults.standardUserDefaults.setValueForKey(value, key);
    }

    public getValue(key: string): any {
        var standardUserDefaults = NSUserDefaults.standardUserDefaults;
        var us = standardUserDefaults.objectForKey(key)
        if (us == null) {
            this.registerDefaultsFromSettingsBundle();
        }

        return NSUserDefaults.standardUserDefaults.objectForKey(key);
    }

    public openSettings() {
        UIApplication.sharedApplication.openURL(NSURL.URLWithString(UIApplicationOpenSettingsURLString));
    }

    public clear() {

    }

    //https://stackoverflow.com/questions/6291477/how-to-retrieve-values-from-settings-bundle-in-objective-c
    private registerDefaultsFromSettingsBundle() {
        var settingsPath = NSBundle.mainBundle.pathForResourceOfType("Settings", "bundle");
        let settingsBundle: NSString = NSString.stringWithString(settingsPath);
        let rootPath = settingsBundle.stringByAppendingPathComponent("Root.plist");

        var settings = NSDictionary.dictionaryWithContentsOfFile(rootPath);
        let preferences = settings.objectForKey("PreferenceSpecifiers");
        let prefs: number = (<any>preferences).count;
        var defaultsToRegister = NSMutableDictionary.alloc().initWithCapacity(prefs);

        for (var i = 0; i < prefs; i++) {
            var prefSpecification = (<any>preferences).objectAtIndex(i);
            var key = prefSpecification.objectForKey("Key")
            if (key) {
                defaultsToRegister.setObjectForKey("", key);
            }
        }

        NSUserDefaults.standardUserDefaults.registerDefaults(defaultsToRegister as any);
        NSUserDefaults.standardUserDefaults.synchronize();
    }
}
