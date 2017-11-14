import * as observable from 'tns-core-modules/data/observable';
import * as pages from 'tns-core-modules/ui/page';
import { Preferences } from 'nativescript-preferences';

let prefs: Preferences;
let page;
let model = null;

// Event handler for Page 'loaded' event attached in main-page.xml
export function pageLoaded(args: observable.EventData) {
    // Get the event sender
    page = <pages.Page>args.object;
    prefs = new Preferences();
    
    model = observable.fromObject({
        name_preference: "Not set",
        enabled_preference: false,
    });

    reloadPrefs();

    setInterval(() => {
        reloadPrefs();
    }, 2000);

    page.bindingContext = model;
}

exports.onOpeniOSSettings = function (args: observable.EventData) {
    prefs.openSettings();
}

exports.onGetValue = function (args: observable.EventData) {
    page.bindingContext.set("message", prefs.getValue(page.bindingContext.get("preferenceKey")));
}

exports.onSetValue = function (args: observable.EventData) {
    var textBox = page.getViewById("setText");
    prefs.setValue(page.bindingContext.get("preferenceKey"), textBox.text);
    page.bindingContext.set("message", prefs.getValue(page.bindingContext.get("preferenceKey")));
}

exports.onDebug = function (args: observable.EventData) {
    debugger;
}

exports.onReload = function (args: observable.EventData) {
    reloadPrefs();
}

exports.onClear = function (args: observable.EventData) {
    prefs.clear();
}

function reloadPrefs() {
    console.log("Reloading prefs");
    model.set("name_preference", prefs.getValue("name_preference", "Not set"));
    model.set("enabled_preference", prefs.getValue("enabled_preference", false));
}