import * as observable from 'tns-core-modules/data/observable';
import * as pages from 'tns-core-modules/ui/page';
import { Preferences } from 'nativescript-preferences';

let prefs: Preferences;
let page;

// Event handler for Page 'loaded' event attached in main-page.xml
export function pageLoaded(args: observable.EventData) {
    // Get the event sender
    page = <pages.Page>args.object;
    prefs = new Preferences();
    page.bindingContext = observable.fromObject({
        preferenceKey: "name_preference"
    });
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